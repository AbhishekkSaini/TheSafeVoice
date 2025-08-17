// Example configuration file - DO NOT commit real credentials
// Copy this file to js/config.js and replace with your actual values

window.SAFEVOICE_CONFIG = {
    // Supabase configuration
    supabaseUrl: "YOUR_SUPABASE_URL_HERE",
    supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY_HERE",
    
    // Google Maps API (optional)
    googleMapsApiKey: "YOUR_GOOGLE_MAPS_API_KEY_HERE",
    
    // Blockchain configuration (optional)
    blockchain: {
        enabled: false,
        rpcUrl: "YOUR_BLOCKCHAIN_RPC_URL_HERE",
        chainId: 11155111,
        contractAddress: "YOUR_CONTRACT_ADDRESS_HERE"
    }
};


