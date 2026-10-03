# Setup Guide

## 1. Clone the repository

```bash
git clone https://github.com/rishavrai563/Algorithmic-Trading-Workbench.git
cd Algorithmic-Trading-Workbench
```

## 2. Frontend setup

Move into the frontend folder:

```bash
cd frontend
```

Install packages:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Build the frontend for production:

```bash
npm run build
```

## 3. Backend setup

The project contains a C# backend. Use the .NET tooling and the project files in the `backend/` folder to restore dependencies, build, and run the backend.

The exact command depends on the C# project file currently present in the repository.

Typical commands are:

```bash
dotnet restore
dotnet build
dotnet run
```

Run these from the folder that contains the backend project file.

## 4. LEAN/backtesting setup

The project also contains a `lean_workspace/` folder for the backtesting workflow.

Use the repository's existing LEAN configuration, strategy files, historical data, and result files when running backtests.

## 5. Environment variables

Do not commit secrets to GitHub. Keep local configuration such as API keys, private tokens, or machine-specific settings in environment files or local configuration that is ignored by Git.

## 6. Common Git workflow

```bash
git pull origin main
git status
git add .
git commit -m "Describe your change"
git push origin main
```

## 7. Frontend files

The main React application is inside `frontend/src/`.

The project uses React components and page-level components to keep the UI organized.
