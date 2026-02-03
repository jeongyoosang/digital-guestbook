Here is the converted Markdown file based on the provided document.

---

# Whale Universe Bank API Development Guide (v 1.0.171)

**Version Information** 

| Item | Content |
| --- | --- |
| **Document Version** | 1.0.171 |
| **First Created** | 2016.05.12 |
| **Last Modified** | 2025.12.19 |

---

## 1. Overview

### 1.1 Description

The Bank API provides functionality to scrape necessary information from bank websites in real-time and offers it as an API.

1.2 Basic Information 

| Category | Value |
| --- | --- |
| **Data Format** | json |
| **Network** | Internet Network |

1.3 API Composition/Flow 

**Process Flow:**

1. 
**Application:** Assembles login data and calls the **[Login API]**.


2. 
**i-SAS 2.0:** Performs Login Scraping on the target institution and returns the response data via **Callback**.


3. 
**Application:** Checks if the login was successful and then calls the necessary API.


4. 
**Session:** The session is maintained after the Login API call, allowing multiple API calls.


* 
Note: APIs that do not require login can be used without calling the Login API.





---

## 2. API

2.1 Personal Banking 

2.1.1 Login 

* Certificate or ID login is available.


* If logging in with ID, the user name is processed in the result.


* 
**Concurrent Login Impossible Institutions:** The following institutions generate a duplicate login error during concurrent login, so they must be called sequentially: Citibank-Citi Card, Woori Bank-Woori Card, NH Bank-NH Card, Gwangju Bank-Gwangju Card, Suhyup Bank-Suhyup Card, Jeonbuk Bank-Jeonbuk Card, KDB Bank-KDB Card.



**Request Element** 

| Attribute | Type | Description |
| --- | --- | --- |
| **Module** | String (Required) | Refer to Financial Institution Codes below |
| **Class** | String (Required) | "개인뱅킹" (Personal Banking) |
| **Job** | String (Required) | "로그인" (Login) |
| **Input** | Object |  |
| └ **로그인방식** | String (Required) | "ID": ID Login, "CERT": Certificate Login |
| └ **사용자아이디** | String |  |
| └ **사용자비밀번호** | String |  |
| └ **구분** | String | "m": Mobile App, "p": PC Web, Others: Mobile App only in mobile environment (Woori Bank uses this) |
| └ **인증서** | Object |  |
|   └ **이름** | String |  |
|   └ **만료일자** | String |  |
|   └ **비밀번호** | String |  |

**Request Sample** 

```json
{
  "Module": "wooribank",
  "Class": "개인뱅킹",
  "Job": "로그인",
  "Input": {
    "로그인방식": "CERT",
    "사용자아이디": "",
    "사용자비밀번호": "",
    "구분": "",
    "인증서": {
      "이름": "cn=홍길동()0004040902779989, ou=KMB,ou=personal4IB,o=yessign,c=kr",
      "만료일자": "20161210",
      "비밀번호": "qwer1234!"
    }
  }
}

```

**Response Element** 

| Attribute | Type | Description |
| --- | --- | --- |
| **ErrorCode** | String (Required) | Result Code ("00000000": Normal, Others: Error) |
| **ErrorMessage** | String | Error Message |
| **Result** | Object (Required) | Lookup Result |
| └ **사용자이름** | String | In case of ID Login |

**Response Sample** 

```json
{
  "Module": "wooribank ",
  "Class": "개인뱅킹",
  "Job": "로그인",
  "Input": { ... },
  "Output": {
    "ErrorCode": "00000000",
    "ErrorMessage": "",
    "Result": {}
  }
}

```

2.1.2 FIN_CERT Login 

**Process:** 1. Login Request → 2. Callback API → 3. Financial Certificate SDK (Digital Signature) → 4. Callback API → 5. Login Response.

1. Login Request Element 

| Attribute | Type | Description |
| --- | --- | --- |
| **Module** | String (Required) | Refer to institutions supporting FIN_CERT Login |
| **Class** | String (Required) | "개인뱅킹" |
| **Job** | String (Required) | "로그인" |
| **Input** | Object |  |
| └ **로그인방식** | String (Required) | "FIN_CERT": KFTC Financial Certificate |

**Request Sample** 

```json
{
  "Module": "kdb",
  "Class": "개인뱅킹",
  "Job": "로그인",
  "Input": {
    "로그인방식": "FIN_CERT"
  }
}

```

2. Response Element (Callback) 

| Attribute | Type | Description |
| --- | --- | --- |
| **ErrorCode** | String (Required) | "00000000": Normal |
| **Result** | Object (Required) |  |
| └ **CallBackfunc** | String | "FIN_CERT" |
| └ **req** | Object |  |
|   └ **API** | String (Required) | "FIN_CERT" |
|   └ **SignParam** | Array | Input parameter for KFTC Financial Certificate SDK `sign()` or `signWithoutUI()` functions. |
|   └ **signFormat** | Object |  |

**Response Sample** 

```json
{
  "Output": {
    "ErrorCode": "00000000",
    "ErrorMessage": "",
    "Result": {
      "CallBackfunc": "FIN_CERT",
      "req": {
        "API": "FIN_CERT",
        "SignParam": [{
          "signFormat": {
             "type": "CMS",
             "CMSInfo": { "ssn": "dummy" },
             "content": {
                "plainText": { "plainTexts": [ "test" ] },
                "info": { "signType": "01" }
             }
          }
        }]
      }
    }
  }
}

```

3. Request Element (After Signing) 

| Attribute | Type | Description |
| --- | --- | --- |
| **Module** | String (Required) | "kdb" etc. |
| **Class** | String (Required) | "개인뱅킹" |
| **Job** | String (Required) | "FIN_CERT" (Value from CallBackfunc) |
| **Input** | Object |  |
| └ **res** | Array |  |
|   └ **signedVals** | Array | Electronic signature using Financial Certificate SDK |
|   └ **certSeqNum** | String | Certificate Serial Number |
| └ **로그인방식** | String | "FIN_CERT" |

**Request Sample** 

```json
{
  "Module": "kdb",
  "Class": "개인뱅킹",
  "Job": "FIN_CERT",
  "Input": {
    "res": [{
      "signedVals": ["MIIHSAYJKoZihvcNAQcCollHoTCCB50CAQExDzANBglghkgBZQMEAgEFADA....."],
      "certSeqNum": "688269802"
    }],
    "로그인방식": "FIN_CERT"
  }
}

```

4. Response Element 

| Attribute | Type | Description |
| --- | --- | --- |
| **ErrorCode** | String (Required) | Result Code ("00000000": Normal, Others: Error) |

2.1.3 Logout 

* Be sure to execute the logout transaction after login transactions.



**Request Element** 

| Attribute | Type | Description |
| --- | --- | --- |
| **Module** | String (Required) | Refer to Financial Institution Codes |
| **Class** | String (Required) | "개인뱅킹" |
| **Job** | String (Required) | "로그아웃" |

**Request Sample** 

```json
{
  "Module": "wooribank",
  "Class": "개인뱅킹",
  "Job": "로그아웃",
  "Input": {}
}

```

2.1.4 Current Transaction History Inquiry (formerly Account Transaction History) 

* Can be called after Certificate Login or ID Login.


* Queries transaction history of demand deposits (withdrawal accounts).


* 
**Note:** Service name changed from 'Account Transaction History' to 'Current Transaction History' (2019.04.29).



**Request Element** 

| Attribute | Type | Description |
| --- | --- | --- |
| **Module** | String (Required) | Refer to Financial Institution Codes |
| **Class** | String (Required) | "개인뱅킹" |
| **Job** | String (Required) | "수시거래내역조회" |
| **Input** | Object |  |
| └ **계좌번호** | String (Required) | "1234951045678" |
| └ **조회시작일** | String (Required) | "20160401" |
| └ **조회종료일** | String (Required) | "20160410" |
| └ **계좌비밀번호** | String | SC Bank: (Individual) Business account requires input |

**Response Element** 

| Attribute | Type | Description |
| --- | --- | --- |
| **ErrorCode** | String (Required) | Result Code |
| **Result** | Object (Required) | Lookup Result |
| └ **내역정렬순서** | String (Required) | 0: Recent first, 1: Past first |
| └ **거래내역조회** | Array | ("수시거래내역조회" or "거래내역조회") |
|   └ **거래일자** | String | Transaction Date |
|   └ **거래시각** | String | Transaction Time |
|   └ **통화코드** | String | Currency Code |
|   └ **출금액** | String | Withdrawal Amount |
|   └ **입금액** | String | Deposit Amount |
|   └ **거래후잔액** | String | Balance after transaction |
|   └ **기재사항 1** | String | Remark 1 |
|   └ **기재사항 2** | String | Remark 2 |
|   └ **거래수단 1** | String | Transaction Method 1 |
|   └ **거래수단 2** | String | Transaction Method 2 |
|   └ **계좌번호** | String | Account Number |
|   └ **상대계좌번호** | String | Counterparty Account Number |
|   └ **상대계좌예금주명** | String | Counterparty Name |

**Response Sample** 

```json
{
  "Module": "wooribank",
  "Class": "개인뱅킹",
  "Job": "수시거래내역조회",
  "Output": {
    "ErrorCode": "00000000",
    "Result": {
      "내역정렬순서": "0",
      "거래내역조회": [
        {
          "거래일자": "20160404",
          "거래시각": "072844",
          "통화코드": "KRW",
          "출금액": "1",
          "입금액": "0",
          "거래후잔액": "100869",
          "기재사항 1": "웹케시글로벌",
          "기재사항 2": "",
          "거래수단 1": "여의영",
          "거래수단 2": "인터넷출금이체",
          "계좌번호": "1234951045678"
        }
      ]
    }
  }
}

```

2.1.5 Past Transaction History Inquiry 

* Queries past transaction history for demand deposit accounts where the site separates recent/past history.



**Request Element** 

| Attribute | Type | Description |
| --- | --- | --- |
| **Job** | String (Required) | "수시과거거래내역조회" |
| **Input** | Object |  |
| └ **조회구분** | String | "1": Request, "2": Lookup (For Citibank, Request(1) must precede Lookup(2)) |
| └ **조회시작일** | String (Required) | "20160401" |
| └ **조회종료일** | String (Required) | "20160410" |

2.2.24 LIST_SELECTION & OTP (CallBackFunc) 

* For multi-transfer transactions requiring additional authentication (ARS), `LIST_SELECTION` -> `OTP` are called sequentially.


* `LIST_SELECTION`'s CallBackFunc is always `OTP`. After `OTP` call, it returns `OTP` or `OTP_CARD`.


* 
**ARS Types:** ARS1 (Input returned code on mobile), ARS2 (Input code guided by voice).



**Request Element** 

| Attribute | Type | Description |
| --- | --- | --- |
| **Job** | String (Required) | "LIST_SELECTION" |
| **Input** | Object |  |
| └ **res** | Object | `{"Option":"010-1234-****", "HiddenValue": ""}` |

**Response Element** 

| Attribute | Type | Description |
| --- | --- | --- |
| **CallBackfunc** | String | "OTP" |
| **req** | Object |  |
| └ **API** | String | "ARS1" or "ARS2" |
| └ **req** | Array |  |
|   └ **Title** | String | "ARS 추가인증입니다." or "인증번호" |
|   └ **Code** | String | Required if API is ARS1 |

2.2.25 OTP, OTP_CARD (CallBackFunc) 

* Outputs Job name (OTP, OTP_CARD API) in CallBackFunc for entering OTP number/additional authentication number or security card.


* If called via Callbackfunc from a preceding transaction (multi-transfer), the result of the preceding transaction is output.



**Request Element** 

| Attribute | Type | Description |
| --- | --- | --- |
| **Job** | String (Required) | "OTP", "OTP_CARD" |
| **Input** | Object |  |
| └ **res** | String/Array | OTP response: String (e.g., "852167"), OTP_CARD response: Array (e.g., `[{"21"}, {"36"}]`). Empty if called by LIST SELECTION. |

**Response Element** 

| Attribute | Type | Description |
| --- | --- | --- |
| **Result** | Object (Required) | Lookup Result |
| **CallBackfunc** | String | "OTP", "OTP_CARD" (If this property exists, invoke the Job of the same name) |
| **req** | Array | If "OTP_CARD" (Security Card), contains code numbers (e.g., `[{"12", "03"}, {"22", "16"}]`) |

---

[Reference] Financial Institution Module Codes 

| Bank Code | Module Code | Institution Name | Bank Code | Module Code | Institution Name |
| --- | --- | --- | --- | --- | --- |
| 002 | kdb | KDB Bank | 020 | wooribank | Woori Bank |
| 003 | ibk | IBK Bank | 023 | standardchartered | SC Bank |
| 004 | kbstar | KB Kookmin Bank | 027 | citibank | Citibank Korea |
| 081 | hanabank | KEB Hana Bank | 031 | dgb | IM Bank (Daegu) |
| 007 | suhyupbank | Suhyup Bank | 032 | busanbank | Busan Bank |
| 011 | nonghyup | Nonghyup Bank | 034 | kjbank | Gwangju Bank |
| 035 | jejubank | Jeju Bank | 045 | kfcc | KFCC (Saemaul) |
| 037 | jbbank | Jeonbuk Bank | 048 | cu | CU (Credit Union) |
| 039 | knbank | Kyongnam Bank | 071 | epostbank | Post Office |
| 088 | shinhan | Shinhan Bank | 089 | kbank | K-Bank |
| 064 | nfcf | Forestry Coop | 090 | kakaobank | Kakao Bank |
| 092 | tossbank | Toss Bank |  |  |  |

[Reference] Lookup Period per Financial Institution 

| Bank | Max Period per Lookup | Max Lookup Range |
| --- | --- | --- |
| **KDB, Suhyup, Shinhan, K-Bank, IM, Jeju, Jeonbuk, Kyongnam, KFCC** | 12 months (or more) | 12 months or more from current day |
| **IBK, KB, NH, Woori, Busan, Gwangju, Hana** | 12 months | 12 months (or more) from current day |
| **SC, Post Office** | 3 months | 12 months / 3 months from current day |
| **Citibank, CU** | 6 months | 6 months / 12 months from current day |

[Reference] Institutions Supporting FIN_CERT Login 

**Personal Banking:** 

* kdb (KDB), kbstar (KB), suhyupbank (Suhyup), wooribank (Woori), standardchartered (SC), dgb (IM), busanbank (Busan), kjbank (Gwangju), jejubank (Jeju), jbbank (Jeonbuk), knbank (Kyongnam), kfcc (Saemaul), hanabank (Hana), shinhan (Shinhan).

**Corporate Banking:** 

* ibk (IBK), kbstar (KB).

[Reference] Error Codes 

| Code | Content |
| --- | --- |
| **42110000** | No results found. |
| **42120011** | Cannot distinguish between checking/savings accounts. Process result from Checking Account Inquiry only. 

 |
| **80002210** | Web ID not entered. |
| **80002214** | ID or Password incorrect. |
| **80002410** | Account number not entered. 

 |
| **80002420** | Account password not entered. |
| **00000000** | Normal (Success). |
| **80002E11** | Service unavailable (Service not provided by institution). 

 |
| **80002F30** | Institution maintenance or server error. |
| **80003270** | Security card/OTP number not entered. 

 |
| **80004100** | Certificate not found. 

 |
| **80004104** | Expired certificate. |

*(Note: See source document for full list of error codes)*.