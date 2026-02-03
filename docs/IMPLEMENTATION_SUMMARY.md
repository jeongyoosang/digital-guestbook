# Bank Scraper Implementation Summary

This document outlines the current implementation of the bank scraping feature, which uses Supabase Edge Functions to interface with a client-side scraping module (Coocon/i-SAS).

## Overview

The system follows a **Client-Side Scraping** model:
1.  **Frontend**: Uses the `i-SAS` module (running locally on the user's device) to interact with bank websites.
2.  **Supabase Edge Functions**: Act as a backend coordination layer to manage session state and store scraped data.
3.  **Supabase Database**: Stores account connections and transaction history.

## Edge Functions

### 1. `coocon-connect`
**Path**: `supabase/functions/coocon-connect/index.ts`

Handles the lifecycle of connecting a bank account.

*   **POST** endpoint.
*   **Authentication**: Requires a valid Supabase Auth Bearer token.
*   **Actions**:
    *   `start`:
        *   Initiates a connection session.
        *   Checks for existing `event_scrape_accounts` to reuse (if `bank_code` matches or if generic).
        *   Creates or updates a record with status `started`.
        *   Returns `scrapeAccountId` to the client.
    *   `finish`:
        *   Called after successful client-side login.
        *   Validates ownership (`event_id`, `owner_user_id`).
        *   Updates the account record to `connected` (or `connected_stub` for testing).
        *   Saves `bank_code`, `bank_name`, `account_masked`, and `verified_at`.

### 2. `coocon-scrape-transactions`
**Path**: `supabase/functions/coocon-scrape-transactions/index.ts`

Processes and stores raw transaction data scraped by the client.

*   **POST** endpoint.
*   **Authentication**: Service Role (mostly for internal use, though code checks headers). *Note: The code initializes an Admin client, so it has full database access.*
*   **Input**: `eventId`, `scrapeAccountId`, `startDate`, `endDate`, and `cooconOutput` (the raw JSON from i-SAS).
*   **Process**:
    1.  **Normalization**: Parses the messy `cooconOutput` to handle various key formats (e.g., `TRN_DT`, `거래일자`, `tx_date`).
    2.  **Validation**: Ensures dates are valid YYYY-MM-DD.
    3.  **Upsert**: Inserts data into `event_scrape_transactions` table.
        *   **Deduplication**: Uses a composite unique key (`event_id`, `scrape_account_id`, `tx_date`, `tx_time`, `amount`, `direction`) to prevent duplicate entries.
        *   **Conflict Strategy**: Ignores duplicates (`ignoreDuplicates: true`).

## Database Tables (Inferred)

The functions rely on the following Supabase tables:

1.  **`event_scrape_accounts`**:
    *   `id`: UUID
    *   `event_id`: UUID
    *   `owner_user_id`: UUID
    *   `provider`: String (e.g., 'coocon')
    *   `bank_code`: String
    *   `bank_name`: String
    *   `account_masked`: String
    *   `status`: String ('started', 'connected', 'connected_stub')
    *   `verified_at`: Timestamp
    *   `created_at`: Timestamp

2.  **`event_scrape_transactions`**:
    *   `event_id`: UUID
    *   `scrape_account_id`: UUID
    *   `tx_date`: Date
    *   `tx_time`: Time
    *   `amount`: Number
    *   `direction`: String ('IN' or 'OUT')
    *   `balance`: Number
    *   `memo`: String
    *   `counterparty`: String
    *   `raw_json`: JSONB

## Integration with Documentation
*   **`docs/api.md`**: Describes the **Whale Universe Bank API** (likely the target for the i-SAS scraper). The Edge Functions consume the output obtained from this API via the i-SAS client.
*   **`docs/i-SAS...`**: Technical guides for the client-side scraping module that generates the `cooconOutput`.
