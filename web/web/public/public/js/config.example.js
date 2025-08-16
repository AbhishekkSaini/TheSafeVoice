// Copy this file to `Safevoice/js/config.js` and fill in your keys
// Do NOT commit real keys to source control.

window.SAFEVOICE_CONFIG = {
    // Supabase project URL (e.g., https://xyzcompany.supabase.co)
    supabaseUrl: "",
    // Supabase anon public key
    supabaseAnonKey: "",

    // Optional: Google Maps API key for SOS map preview
    googleMapsApiKey: "",

    // Optional: Blockchain verification of SOS events
    blockchain: {
        enabled: false,
        // RPC URL for the chosen chain (e.g., Sepolia testnet)
        rpcUrl: "",
        chainId: 11155111,
        // If you deploy a contract to anchor SOS hashes, set it here
        contractAddress: ""
    }
};


