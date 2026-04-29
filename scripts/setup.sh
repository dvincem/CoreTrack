#!/bin/bash

# ==============================================================================
# CoreTrack Automated Deployment Script (Ubuntu)
# ==============================================================================
# This script automates Phases 1-5 of the CoreTrack setup.
# Run with: sudo bash setup.sh
# ==============================================================================

set -e # Exit on error

# --- COLORS ---
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting CoreTrack Automated Setup...${NC}"

# --- PHASE 1: SYSTEM PREPARATION ---
echo -e "${YELLOW}🛠 Phase 1: Checking System Dependencies...${NC}"
if [ "$EUID" -ne 0 ]; then
    echo -e "${YELLOW}Notice: Not running as root. Skipping system package installation (apt).${NC}"
    echo -e "${YELLOW}Ensure node, npm, sqlite3, and build-essential are installed.${NC}"
else
    apt update && apt upgrade -y
    apt install -y build-essential curl git ufw sqlite3

    echo -e "${YELLOW}📦 Installing Node.js 20 LTS...${NC}"
    if ! command -v node &> /dev/null || [[ $(node -v) != v20* ]]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt install -y nodejs
    fi

    if ! command -v pm2 &> /dev/null; then
        echo -e "${BLUE}Installing PM2...${NC}"
        npm install -g pm2
    fi
fi

# --- PHASE 2: NETWORK CONFIGURATION ---
echo -e "${YELLOW}🌐 Phase 2: Configuring Firewall...${NC}"
if [ "$EUID" -ne 0 ]; then
    echo -e "${YELLOW}Notice: Not running as root. Skipping firewall configuration (ufw).${NC}"
else
    ufw allow 3000/tcp
    ufw allow 22/tcp # Keep SSH open!
    ufw --force enable
fi

LOCAL_IP=$(hostname -I | awk '{print $1}' || echo "localhost")
echo -e "${GREEN}✅ Local IP identified as: ${LOCAL_IP}${NC}"

# --- PHASE 3: DEPLOYMENT PROCEDURE ---
echo -e "${YELLOW}🚀 Phase 3: Cloning and Building Application...${NC}"

# Navigate to the repo root (assuming script is in scripts/)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR/.."

echo -e "${BLUE}Installing NPM packages (this may take a while)...${NC}"
npm install

echo -e "${BLUE}Setting up Environment Variables...${NC}"
if [ ! -f ".env" ]; then
    cp .env.example .env
    # Generate a random secret for JWT
    RANDOM_SECRET=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
    sed -i "s/JWT_SECRET=.*/JWT_SECRET=$RANDOM_SECRET/" .env
    echo -e "${GREEN}✅ Generated .env with a secure JWT_SECRET.${NC}"
else
    echo -e "${BLUE}Using existing .env file.${NC}"
fi

echo -e "${BLUE}Building Frontend Assets (Vite)...${NC}"
npm run build

# --- PHASE 4: PROCESS MANAGEMENT ---
echo -e "${YELLOW}⚙️ Phase 4: Setting up Auto-Start with PM2...${NC}"
pm2 delete coretrack || true
fuser -k 3000/tcp || true
pm2 start server.js --name "coretrack"
pm2 save

# Setup PM2 Startup
echo -e "${BLUE}Configuring systemd for auto-boot...${NC}"
if [ "$EUID" -ne 0 ]; then
    echo -e "${YELLOW}Notice: Not running as root. Skipping PM2 systemd startup configuration.${NC}"
else
    PM2_STARTUP=$(pm2 startup systemd | grep "sudo env" || true)
    if [ ! -z "$PM2_STARTUP" ]; then
        eval "$PM2_STARTUP"
    fi
fi
pm2 save

# --- PHASE 5: INTELLIGENCE LAYER ---
echo -e "${YELLOW}🧠 Phase 5: Setting up AI Engine (Ollama)...${NC}"
if ! command -v ollama &> /dev/null; then
    if [ "$EUID" -ne 0 ]; then
        echo -e "${RED}Error: Ollama is not installed and root access is unavailable for installation.${NC}"
        echo -e "${YELLOW}Please install Ollama manually: https://ollama.com/download${NC}"
    else
        echo -e "${BLUE}Installing Ollama...${NC}"
        curl -fsSL https://ollama.com/install.sh | sh
    fi
fi

# Ensure Ollama service is running
if [ "$EUID" -eq 0 ]; then
    systemctl enable ollama || true
    systemctl start ollama || true
else
    echo -e "${YELLOW}Notice: Not running as root. Assuming Ollama service is managed externally or already running.${NC}"
fi

if command -v ollama &> /dev/null; then
    echo -e "${BLUE}Pulling Llama 3.2:3b model...${NC}"
    ollama pull llama3.2:3b
fi

# --- FINAL SUMMARY ---
echo -e "\n${GREEN}================================================================${NC}"
echo -e "${GREEN}🎉 CORETRACK SETUP COMPLETE!${NC}"
echo -e "${GREEN}================================================================${NC}"
echo -e "Access the system at:"
echo -e "Local Network:  ${BLUE}http://${LOCAL_IP}:3000${NC}"
echo -e "Local Machine:  ${BLUE}http://localhost:3000${NC}"
echo -e "\n${YELLOW}Next Steps:${NC}"
echo -e "1. Open the URL above in your browser to start the ${BLUE}Setup Wizard${NC}."
echo -e "2. Transfer your 'tire_shop.db' to $(pwd)/ if you have existing data."
echo -e "3. Monitor server logs with: ${BLUE}pm2 logs coretrack${NC}"
echo -e "4. Check AI health with: ${BLUE}ollama list${NC}"
echo -e "${GREEN}================================================================${NC}\n"

