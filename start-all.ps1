# Start-All.ps1 - Launcher for Smart Crop Advisory Services

Write-Host "🚀 Starting Smart Crop Advisory System..." -ForegroundColor Green

# 1. Run migrations
Write-Host "🔄 Running PostgreSQL migrations..." -ForegroundColor Cyan
cd backend
node migrate.js
if ($LASTEXITCODE -ne 0) {
    Write-Warning "⚠️ Database migrations failed. Proceeding with in-memory fallback storage mode."
}
cd ..

# 2. Start Advisory Engine (Python FastAPI)
Write-Host "🐍 Starting Python Advisory Engine on port 8001..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd advisory-engine; python -m uvicorn main:app --port 8001" -WindowStyle Normal

# 3. Start Vision Engine (Python FastAPI)
Write-Host "🐍 Starting Python Vision Engine on port 8002..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd vision-engine; python -m uvicorn main:app --port 8002" -WindowStyle Normal

# 4. Start Node.js API Gateway Backend on port 3000
Write-Host "🟢 Starting Node.js Backend on port 3000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; npm run dev" -WindowStyle Normal

# 5. Start Frontend Web App on port 5173
Write-Host "💻 Starting Frontend Web App on port 5173..." -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend-web; npm run dev" -WindowStyle Normal

Write-Host "🎉 All services spawned in separate terminal windows!" -ForegroundColor Green
Write-Host "👉 Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "👉 Backend docs: http://localhost:3000/api/docs" -ForegroundColor Cyan
