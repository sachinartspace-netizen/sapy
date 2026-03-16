"""
License key generation and validation system
Handles RSA-2048 encryption, device binding, and offline validation
"""

from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.backends import default_backend
import os
import json
import base64
from datetime import datetime, timedelta
from typing import Optional, Tuple
import hashlib

class LicenseGenerator:
    """
    Generate and validate cryptographic license keys for Sapy
    
    License format: SAPY-XXXX-XXXX-XXXX-XXXX
    Each license is:
      - Tied to a device ID (SHA256 hash of device fingerprint)
      - Includes subscription tier (FREE/BASIC/STANDARD/PREMIUM)
      - Includes expiry date
      - Cryptographically signed
      - Cannot be transferred to another device
    """
    
    # RSA key size (production: 2048 bits)
    KEY_SIZE = 2048
    
    # Paths for key files (use app directory for local, env for production)
    PRIVATE_KEY_PATH = os.getenv("LICENSE_PRIVATE_KEY_PATH", "./licenses/private_key.pem")
    PUBLIC_KEY_PATH = os.getenv("LICENSE_PUBLIC_KEY_PATH", "./licenses/public_key.pem")
    
    def __init__(self):
        """Initialize license generator with RSA keys"""
        self.private_key = None
        self.public_key = None
        self._load_or_generate_keys()
    
    def _load_or_generate_keys(self):
        """Load existing RSA keys or generate new ones"""
        
        # Create licenses directory if needed
        os.makedirs(os.path.dirname(self.PRIVATE_KEY_PATH) or ".", exist_ok=True)
        
        # Try to load existing keys
        if os.path.exists(self.PRIVATE_KEY_PATH) and os.path.exists(self.PUBLIC_KEY_PATH):
            try:
                with open(self.PRIVATE_KEY_PATH, "rb") as f:
                    self.private_key = serialization.load_pem_private_key(
                        f.read(),
                        password=None,
                        backend=default_backend()
                    )
                
                with open(self.PUBLIC_KEY_PATH, "rb") as f:
                    self.public_key = serialization.load_pem_public_key(
                        f.read(),
                        backend=default_backend()
                    )
                
                print(f"✅ Loaded existing RSA keys")
                return
            except Exception as e:
                print(f"⚠️ Failed to load keys: {e}, generating new ones...")
        
        # Generate new RSA key pair
        print(f"🔑 Generating new RSA-{self.KEY_SIZE} key pair...")
        self.private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=self.KEY_SIZE,
            backend=default_backend()
        )
        self.public_key = self.private_key.public_key()
        
        # Save keys
        self._save_keys()
        print(f"✅ Generated and saved RSA keys")
    
    def _save_keys(self):
        """Save RSA keys to files"""
        # Create directory
        os.makedirs(os.path.dirname(self.PRIVATE_KEY_PATH) or ".", exist_ok=True)
        
        # Save private key
        private_pem = self.private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        )
        
        with open(self.PRIVATE_KEY_PATH, "wb") as f:
            f.write(private_pem)
        
        # Save public key
        public_pem = self.public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )
        
        with open(self.PUBLIC_KEY_PATH, "wb") as f:
            f.write(public_pem)
        
        print(f"✅ Keys saved to {self.PRIVATE_KEY_PATH} and {self.PUBLIC_KEY_PATH}")
    
    def generate_license(
        self,
        user_id: int,
        device_id: str,
        tier: str,
        expiry_days: int = 365
    ) -> Tuple[str, str, datetime]:
        """
        Generate a license key for a device
        
        Args:
            user_id: User's ID
            device_id: Device fingerprint (SHA256)
            tier: Subscription tier (FREE, BASIC, STANDARD, PREMIUM)
            expiry_days: Days until license expires
            
        Returns:
            Tuple of (license_key, signature_hex, expiry_datetime)
        """
        
        # Calculate expiry
        expiry_date = datetime.utcnow() + timedelta(days=expiry_days)
        
        # Create license data
        license_data = {
            "user_id": user_id,
            "device_id": device_id,
            "tier": tier,
            "issued_at": datetime.utcnow().isoformat(),
            "expires_at": expiry_date.isoformat(),
            "version": "1.0"
        }
        
        # Convert to JSON
        license_json = json.dumps(license_data, separators=(',', ':'))
        license_bytes = license_json.encode('utf-8')
        
        # Sign with private key
        signature = self.private_key.sign(
            license_bytes,
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH
            ),
            hashes.SHA256()
        )
        
        # Encode signature in hex
        signature_hex = signature.hex()
        
        # Create license key (SAPY-XXXX-XXXX-XXXX-XXXX format)
        # Use first 16 chars of license_json hash
        license_hash = hashlib.sha256(license_bytes).hexdigest()[:16].upper()
        license_key = f"SAPY-{license_hash[0:4]}-{license_hash[4:8]}-{license_hash[8:12]}-{license_hash[12:16]}"
        
        return license_key, signature_hex, expiry_date
    
    def validate_license(
        self,
        license_data: dict,
        signature_hex: str,
        device_id: str
    ) -> Tuple[bool, str]:
        """
        Validate a license key (offline capable)
        
        Args:
            license_data: Decoded license JSON
            signature_hex: Signature from server
            device_id: Device to validate against
            
        Returns:
            Tuple of (is_valid, reason_string)
        """
        
        # Check if license is for this device
        if license_data.get("device_id") != device_id:
            return False, "License not valid for this device"
        
        # Check if license is expired
        expires_at = license_data.get("expires_at")
        if expires_at:
            try:
                expiry_time = datetime.fromisoformat(expires_at)
                if datetime.utcnow() > expiry_time:
                    return False, f"License expired on {expires_at}"
            except ValueError:
                return False, "Invalid expiry date format"
        
        # Verify signature (requires public key)
        try:
            license_json = json.dumps(license_data, separators=(',', ':'))
            license_bytes = license_json.encode('utf-8')
            signature_bytes = bytes.fromhex(signature_hex)
            
            self.public_key.verify(
                signature_bytes,
                license_bytes,
                padding.PSS(
                    mgf=padding.MGF1(hashes.SHA256()),
                    salt_length=padding.PSS.MAX_LENGTH
                ),
                hashes.SHA256()
            )
        except Exception as e:
            return False, f"Invalid signature: {str(e)}"
        
        # All checks passed
        return True, "License is valid"
    
    def get_public_key_pem(self) -> str:
        """
        Get public key in PEM format (for bundling in mobile apps)
        
        Returns:
            PEM-encoded public key
        """
        return self.public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        ).decode('utf-8')
    
    @staticmethod
    def hash_device_fingerprint(device_info: dict) -> str:
        """
        Generate device ID from device fingerprint
        
        Args:
            device_info: Dictionary with device info
                {
                    "os": "iOS/Android/macOS/Windows",
                    "device_model": "iPhone 12",
                    "device_id": "hardware ID",
                    "app_version": "1.0.0"
                }
        
        Returns:
            SHA256 hash of device info
        """
        
        # Create canonical string from device info
        canonical = json.dumps(device_info, sort_keys=True, separators=(',', ':'))
        
        # Hash it
        device_hash = hashlib.sha256(canonical.encode('utf-8')).hexdigest()
        
        return device_hash


# Global instance
_license_generator = None

def get_license_generator() -> LicenseGenerator:
    """Get or create global license generator instance"""
    global _license_generator
    
    if _license_generator is None:
        _license_generator = LicenseGenerator()
    
    return _license_generator
