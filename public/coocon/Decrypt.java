
import com.coocon.securty.util.ISASSeedCBC; // Note: 'securty' typo is in the package name
import java.net.URLDecoder;

public class Decrypt {
    public static void main(String[] args) {
        if (args.length < 3) {
            System.out.println("Usage: java -cp .:path/to/isas1.0.jar Decrypt <Data> <Uid> <Action>");
            System.out.println("Note: Pass the 'Result' string as Data.");
            return;
        }

        String data = args[0];
        String uid = args[1];
        String action = args[2];

        System.out.println("Attempting decryption with:");
        System.out.println("Data (len): " + data.length());
        System.out.println("Uid: " + uid);
        System.out.println("Action: " + action);

        try {
            // Strategy 1: Standard Decrypt
            System.out.println("\n--- Strategy 1: ISASSeedCBC.decrypt(data, uid, action) ---");
            String result = ISASSeedCBC.decrypt(data, uid, action);
            System.out.println("Result: " + result);
        } catch (Exception e) {
             System.out.println("Strategy 1 Failed: " + e.getMessage());
             e.printStackTrace();
        }

        try {
            // Strategy 2: Decrypt with just Data (Static Key)
            System.out.println("\n--- Strategy 2: ISASSeedCBC.decrypt(data) ---");
            String result2 = ISASSeedCBC.decrypt(data);
             System.out.println("Result 2: " + result2);
        } catch (Exception e) {
             System.out.println("Strategy 2 Failed: " + e.getMessage());
        }
    }
}
