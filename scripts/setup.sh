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
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting CoreTrack Automated Setup...${NC}"

# --- PHASE 1: SYSTEM PREPARATION ---
echo -e "${YELLOW}🛠 Phase 1: Installing Core Dependencies...${NC}"
apt update && apt upgrade -y
apt install -y build-essential curl git ufw sqlite3

echo -e "${YELLOW}📦 Installing Node.js 20 LTS...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2

# --- PHASE 2: NETWORK CONFIGURATION ---
echo -e "${YELLOW}🌐 Phase 2: Configuring Firewall...${NC}"
ufw allow 3000/tcp
ufw allow 22/tcp # Keep SSH open!
ufw --force enable

LOCAL_IP=$(hostname -I | awk '{print $1}')
echo -e "${GREEN}✅ Firewall active. Your Local IP is: ${LOCAL_IP}${NC}"

# --- PHASE 3: DEPLOYMENT PROCEDURE ---
echo -e "${YELLOW}🚀 Phase 3: Cloning and Building Application...${NC}"
# Use the current directory if we're already in the repo, otherwise clone
if [ ! -f "package.json" ]; then
    echo -e "${BLUE}Cloning repository...${NC}"
    git clone https://github.com/dvincem/CoreTrack.git
    cd CoreTrack
fi

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

echo -e "${BLUE}Building Frontend Assets...${NC}"
npm run build

# --- PHASE 4: PROCESS MANAGEMENT ---
echo -e "${YELLOW}⚙️ Phase 4: Setting up Auto-Start with PM2...${NC}"
pm2 delete coretrack || true
pm2 start server.js --name "coretrack"
pm2 save

# Setup PM2 Startup
echo -e "${BLUE}Configuring systemd for auto-boot...${NC}"
PM2_STARTUP=$(pm2 startup systemd | grep "sudo env")
if [ ! -z "$PM2_STARTUP" ]; then
    eval "$PM2_STARTUP"
fi
pm2 save

# --- PHASE 5: INTELLIGENCE LAYER ---
echo -e "${YELLOW}🧠 Phase 5: Setting up AI Engine (Ollama)...${NC}"
if ! command -v ollama &> /dev/null; then
    curl -fsSL https://ollama.com/install.sh | sh
fi

echo -e "${BLUE}Pulling Llama 3.2 model (this may take a while)...${NC}"
ollama pull llama3.2

# --- FINAL SUMMARY ---
echo -e "\n${GREEN}================================================================${NC}"
echo -e "${GREEN}🎉 SETUP COMPLETE!${NC}"
echo -e "${GREEN}================================================================${NC}"
echo -e "Access the system at:"
echo -e "Local Network:  ${BLUE}http://${LOCAL_IP}:3000${NC}"
echo -e "Local Machine:  ${BLUE}http://localhost:3000${NC}"
echo -e "\n${YELLOW}Next Steps:${NC}"
echo -e "1. Transfer your 'tire_shop.db' to $(pwd)/ if you have existing data."
echo -e "2. Log in with the credentials defined in your .env file."
echo -e "3. Run 'pm2 logs' to monitor server activity."
echo -e "${GREEN}================================================================${NC}\n"
