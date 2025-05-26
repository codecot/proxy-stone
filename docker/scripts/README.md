# Proxy Stone Scripts

This directory contains convenience scripts to manage your Proxy Stone Docker configurations.

## 🖥️ Platform Compatibility

| Platform    | Script Type         | Status                     |
| ----------- | ------------------- | -------------------------- |
| **Linux**   | Bash (`.sh`)        | ✅ Fully supported         |
| **macOS**   | Bash (`.sh`)        | ✅ Fully supported         |
| **Windows** | Batch (`.bat`)      | ✅ Fully supported         |
| **Windows** | PowerShell (`.ps1`) | ✅ Recommended for Windows |

### Windows Users

- **Batch files** (`.bat`) work in Command Prompt and PowerShell
- **PowerShell scripts** (`.ps1`) provide better functionality and colors
- **WSL users** can use the Linux/Bash scripts (`.sh`)

## 🚀 Quick Start

### Interactive Launcher (Recommended)

**Linux/macOS:**

```bash
./scripts/launcher.sh
```

**Windows (PowerShell - Recommended):**

```powershell
.\scripts\launcher.ps1
```

**Windows (Command Prompt):**

```cmd
# Note: Interactive launcher not available in batch
# Use direct commands instead
```

This provides an interactive menu to start, stop, and manage all configurations.

### Direct Script Usage

#### Start Services

**Linux/macOS:**

```bash
# SQLite (Development)
./scripts/start-sqlite.sh -d

# MySQL (Production)
./scripts/start-mysql.sh -d

# PostgreSQL (Production)
./scripts/start-postgresql.sh -d
```

**Windows:**

```cmd
REM SQLite (Development)
scripts\start-sqlite.bat -d

REM MySQL (Production)
scripts\start-mysql.bat -d

REM PostgreSQL (Production)
scripts\start-postgresql.bat -d
```

#### Check Status

**Linux/macOS:**

```bash
./scripts/status.sh
```

**Windows:**

```cmd
REM Status checking available via PowerShell launcher
powershell .\scripts\launcher.ps1
```

#### Stop Services

**Linux/macOS:**

```bash
./scripts/stop-all.sh
```

**Windows:**

```cmd
scripts\stop-all.bat
```

## 📋 Available Scripts

### `launcher.sh` - Interactive Menu

- **Purpose**: Interactive launcher with colored menu
- **Features**:
  - Choose configuration (SQLite/MySQL/PostgreSQL)
  - Select startup mode (foreground/background/rebuild)
  - Status checking
  - Stop all services
  - Clean all data
- **Usage**: `./scripts/launcher.sh`

### `start-sqlite.sh` - SQLite Configuration

- **Purpose**: Start SQLite-based stack
- **Services**: Frontend UI, Proxy API, Redis, Redis Commander
- **Ports**: 3000 (UI), 4000 (API), 6379 (Redis), 8081 (Redis UI)
- **Options**:
  - `-d, --detached`: Run in background
  - `-b, --build`: Force rebuild images
  - `-l, --logs`: Show logs after starting
  - `-h, --help`: Show help

### `start-mysql.sh` - MySQL Configuration

- **Purpose**: Start MySQL-based stack
- **Services**: Frontend UI, Proxy API, MySQL, Adminer, Redis, Redis Commander
- **Ports**: 3000 (UI), 4000 (API), 3306 (MySQL), 8080 (Adminer), 6379 (Redis), 8081 (Redis UI)
- **Default Credentials**: devuser/devpass
- **Options**: Same as SQLite script

### `start-postgresql.sh` - PostgreSQL Configuration

- **Purpose**: Start PostgreSQL-based stack
- **Services**: Frontend UI, Proxy API, PostgreSQL, pgAdmin, Redis, Redis Commander
- **Ports**: 3000 (UI), 4000 (API), 5432 (PostgreSQL), 5050 (pgAdmin), 6379 (Redis), 8081 (Redis UI)
- **Default Credentials**:
  - DB: devuser/devpass
  - pgAdmin: admin@local.dev/adminpass
- **Options**: Same as SQLite script

### `stop-all.sh` - Stop All Services

- **Purpose**: Stop all running Proxy Stone configurations
- **Features**:
  - Stops SQLite, MySQL, and PostgreSQL configurations
  - Cleans up orphaned containers
  - Optional volume removal
- **Options**:
  - `-v, --volumes`: Remove volumes (⚠️ **DATA LOSS**)
  - `-h, --help`: Show help

### `status.sh` - Status Check

- **Purpose**: Check status of all configurations
- **Features**:
  - Shows running services for each configuration
  - Tests service health (HTTP responses)
  - Displays resource usage
  - Provides quick command references
- **Usage**: `./scripts/status.sh`

## 🎯 Common Usage Patterns

### Development Workflow

```bash
# Start SQLite for development
./scripts/start-sqlite.sh -d

# Check what's running
./scripts/status.sh

# Stop when done
./scripts/stop-all.sh
```

### Production Testing

```bash
# Test with MySQL
./scripts/start-mysql.sh -d -b

# Test with PostgreSQL
./scripts/stop-all.sh
./scripts/start-postgresql.sh -d

# Clean everything
./scripts/stop-all.sh -v
```

### Interactive Management

```bash
# Use the launcher for guided experience
./scripts/launcher.sh
```

## 🔧 Script Options

All start scripts support these common options:

| Option       | Short | Description                               |
| ------------ | ----- | ----------------------------------------- |
| `--detached` | `-d`  | Run in background (recommended)           |
| `--build`    | `-b`  | Force rebuild Docker images               |
| `--logs`     | `-l`  | Show logs after starting (only with `-d`) |
| `--help`     | `-h`  | Show help message                         |

## 🌐 Service URLs

When services are running, access them at:

| Service                  | URL                          | Purpose                    |
| ------------------------ | ---------------------------- | -------------------------- |
| **Frontend UI**          | http://localhost:3000        | Main application interface |
| **Proxy API**            | http://localhost:4000        | Backend API endpoints      |
| **Health Check**         | http://localhost:4000/health | API health status          |
| **Redis Commander**      | http://localhost:8081        | Redis cache management     |
| **Adminer** (MySQL)      | http://localhost:8080        | MySQL database admin       |
| **pgAdmin** (PostgreSQL) | http://localhost:5050        | PostgreSQL database admin  |

## 🛠️ Troubleshooting

### Scripts Not Executable

```bash
chmod +x scripts/*.sh
```

### Port Conflicts

- Check what's using the ports: `netstat -tulpn | grep :3000`
- Stop conflicting services or change ports in Docker Compose files

### Docker Not Running

```bash
# Start Docker service
sudo systemctl start docker

# Or on macOS/Windows, start Docker Desktop
```

### Permission Issues

```bash
# Add user to docker group (Linux)
sudo usermod -aG docker $USER
# Then logout and login again
```

### View Logs

```bash
# For specific configuration
docker-compose -f docker-compose.sqlite.yml logs -f

# For specific service
docker-compose -f docker-compose.mysql.yml logs proxy
```

## 📝 Environment Variables

Create a `.env` file in the project root to customize:

```bash
# MySQL
MYSQL_ROOT_PASSWORD=your_password
MYSQL_DATABASE=your_db_name
MYSQL_USER=your_username
MYSQL_PASSWORD=your_password

# PostgreSQL
POSTGRES_USER=your_username
POSTGRES_PASSWORD=your_password
POSTGRES_DB=your_db_name

# pgAdmin
PGADMIN_EMAIL=your_email@domain.com
PGADMIN_PASSWORD=your_admin_password
```

## 🪟 Windows-Specific Information

### Available Windows Scripts

| Script                 | Purpose                     | Usage                             |
| ---------------------- | --------------------------- | --------------------------------- |
| `launcher.bat`         | Interactive menu (basic)    | `scripts\launcher.bat`            |
| `launcher.ps1`         | Interactive menu (advanced) | `.\scripts\launcher.ps1`          |
| `start-sqlite.bat`     | Start SQLite config         | `scripts\start-sqlite.bat -d`     |
| `start-mysql.bat`      | Start MySQL config          | `scripts\start-mysql.bat -d`      |
| `start-postgresql.bat` | Start PostgreSQL config     | `scripts\start-postgresql.bat -d` |
| `stop-all.bat`         | Stop all services           | `scripts\stop-all.bat`            |

### Windows Usage Examples

**Command Prompt:**

```cmd
REM Start SQLite in background
scripts\start-sqlite.bat -d

REM Start MySQL with rebuild
scripts\start-mysql.bat -d -b

REM Stop all services
scripts\stop-all.bat

REM Interactive launcher
scripts\launcher.bat
```

**PowerShell:**

```powershell
# Interactive launcher (recommended)
.\scripts\launcher.ps1

# Direct commands also work
.\scripts\start-sqlite.bat -d
```

### Windows Prerequisites

1. **Docker Desktop** must be installed and running
2. **PowerShell 5.0+** (for `.ps1` scripts)
3. **Command Prompt** or **PowerShell** terminal

### Windows Troubleshooting

**PowerShell Execution Policy:**

```powershell
# If you get execution policy errors
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Path Issues:**

- Use `scripts\` (backslash) instead of `scripts/` (forward slash)
- Run from project root directory
- Use `.\scripts\launcher.ps1` for PowerShell scripts

**Docker Issues:**

- Ensure Docker Desktop is running
- Check if Docker is accessible: `docker --version`
- Restart Docker Desktop if needed
