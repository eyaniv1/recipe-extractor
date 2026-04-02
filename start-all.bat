@echo off
echo Installing dependencies...
cd server && call npm install && cd ..
cd client && call npm install && cd ..
call npm install
echo Starting dev servers...
npm run dev
