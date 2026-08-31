import os
import time
import random
from urllib.parse import urlparse
import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from faker import Faker

# Load credentials from .env file
load_dotenv()

app = Flask(__name__)
CORS(app)
fake = Faker()

PINATA_JWT = os.getenv("PINATA_JWT")
PINATA_API_KEY = os.getenv("PINATA_API_KEY")
PINATA_API_SECRET = os.getenv("PINATA_API_SECRET")

# In-memory database of activities for the Unity Dashboard to poll
EVENTS_LOGS = []

def log_event(message):
    EVENTS_LOGS.append({
        "timestamp": int(time.time()),
        "event": message
    })
    # Keep only the last 20 events to avoid memory bloat
    if len(EVENTS_LOGS) > 20:
        EVENTS_LOGS.pop(0)

def pin_to_ipfs(identity_data):
    url = "https://api.pinata.cloud/pinning/pinJSONToIPFS"
    payload = {
        "pinataContent": identity_data,
        "pinataMetadata": {
            "name": "IdentityShield_RealPersona"
        }
    }
    
    headers = {}
    if PINATA_JWT:
        headers["Authorization"] = f"Bearer {PINATA_JWT}"
    elif PINATA_API_KEY and PINATA_API_SECRET:
        headers["pinata_api_key"] = PINATA_API_KEY
        headers["pinata_secret_api_key"] = PINATA_API_SECRET
    else:
        raise ValueError("Pinata credentials not found in environment variables.")
        
    response = requests.post(url, json=payload, headers=headers)
    if response.status_code == 200:
        return response.json().get("IpfsHash")
    else:
        raise Exception(f"Pinata API returned status code {response.status_code}: {response.text}")

def simulate_blockchain_transaction():
    # Generate a random mock EVM transaction hash
    chars = "0123456789abcdef"
    tx_hash = "0x" + "".join(random.choices(chars, k=64))
    explorer_url = f"https://sepolia.etherscan.io/tx/{tx_hash}"
    return tx_hash, explorer_url

def build_rich_persona(domain=None, seed=None):
    local_fake = Faker()
    if seed is not None:
        local_fake.seed_instance(seed)
    elif domain:
        # Generate deterministic seed integer from domain string
        domain_hash = sum(ord(c) * (31 ** i % 1000003) for i, c in enumerate(domain))
        local_fake.seed_instance(domain_hash)

    first_name = local_fake.first_name()
    last_name = local_fake.last_name()
    full_name = f"{first_name} {last_name}"
    safe_domain_tag = domain.replace('.', '_').replace(':', '') if domain else "web"
    sanitized_first = "".join(c for c in first_name.lower() if c.isalnum())
    sanitized_last = "".join(c for c in last_name.lower() if c.isalnum())
    decoy_email = f"{sanitized_first}.{sanitized_last}.{random.randint(10, 99)}@shieldmail.dev"
    username = f"{sanitized_first}_{sanitized_last}{random.randint(10, 99)}"

    return {
        "name": full_name,
        "first_name": first_name,
        "last_name": last_name,
        "email": decoy_email,
        "username": username,
        "phone": local_fake.phone_number(),
        "job": local_fake.job(),
        "company": local_fake.company(),
        "address": local_fake.street_address(),
        "city": local_fake.city(),
        "state": local_fake.state(),
        "zipcode": local_fake.zipcode(),
        "country": local_fake.country(),
        "location": f"{local_fake.city()}, {local_fake.country()}",
        "domain": domain or "global"
    }

@app.route('/', methods=['GET'])
def home():
    return jsonify({
        "message": "Welcome to the Identity Shield Engine API!",
        "version": "1.2",
        "endpoints": {
            "/generate": "GET/POST - Generate domain-specific or global shadow persona",
            "/logs": "GET - Fetch real-time system event telemetry",
            "/vault": "POST - Pin encrypted zero-knowledge bundle to IPFS"
        }
    })

@app.route('/logs', methods=['GET'])
def get_logs():
    return jsonify(EVENTS_LOGS)

@app.route('/generate', methods=['GET', 'POST'])
def generate_identity():
    url_param = request.args.get("url") or ""
    domain_param = request.args.get("domain") or ""
    force_refresh = request.args.get("force", "false").lower() == "true"

    domain = None
    if domain_param:
        domain = domain_param
    elif url_param:
        try:
            domain = urlparse(url_param).netloc or url_param
        except Exception:
            domain = url_param

    # If force_refresh is True, we don't fix the seed to allow fresh generation
    fake_identity = build_rich_persona(domain=None if force_refresh else domain)

    if request.method == 'POST':
        real_data = request.get_json(silent=True) or {}
        real_name = real_data.get("real_name", "Anonymous")
        
        try:
            # 1. Store in Decentralized Vault (IPFS)
            ipfs_hash = pin_to_ipfs(real_data)
            gateway_base = os.getenv("PINATA_GATEWAY_URL", "https://ipfs.io").rstrip("/")
            ipfs_url = f"{gateway_base}/ipfs/{ipfs_hash}"
            
            # 2. Record CID on Blockchain (Simulation Mode)
            tx_hash, tx_url = simulate_blockchain_transaction()
            
            # 3. Log event
            log_event(f"🔒 Vaulted Identity ({real_name}) -> CID: {ipfs_hash[:8]}... | On-Chain Tx: {tx_hash[:10]}...")
            
            return jsonify({
                "fake_identity": fake_identity,
                "ipfs_cid": ipfs_hash,
                "ipfs_url": ipfs_url,
                "blockchain_tx_hash": tx_hash,
                "blockchain_explorer_url": tx_url,
                "status": "pinned_and_logged"
            })
        except Exception as e:
            log_event(f"❌ Failed to vault identity for {real_name}: {str(e)}")
            return jsonify({
                "fake_identity": fake_identity,
                "ipfs_cid": None,
                "status": "failed",
                "error": str(e)
            }), 500
            
    # GET method
    if domain:
        log_event(f"🛡️ Domain [{domain}] protected as {fake_identity['name']} ({fake_identity['job']})")
    else:
        log_event(f"👤 Generated shadow persona: {fake_identity['name']} ({fake_identity['job']})")
        
    return jsonify(fake_identity)

if __name__ == '__main__':
    app.run(port=5000, debug=True)
