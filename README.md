# FSD Lab - Microservices Architecture

This project demonstrates a microservices architecture with three separate services that communicate with a shared MongoDB database through Docker containers.

## Services Overview

### 1. Main Server (Port 5000)
- Basic Express server
- Serves as the main application server
- Connects to MongoDB database

### 2. User Service (Port 3002)
- Handles user registration and authentication
- Manages user data in MongoDB

### 3. Product Service (Port 3001)
- Manages product data
- Handles CRUD operations for products

### 4. MongoDB Database (Port 27018)
- Shared database for all services
- Accessible internally on port 27017 within the Docker network

## Prerequisites

- Docker
- Docker Compose

## Setup and Installation

1. Clone the repository
2. Navigate to the project directory
3. Run the following command to start all services:

```bash
docker-compose up --build
```

This will build and start all containers:
- MongoDB database
- Main server
- User service
- Product service

## API Endpoints

### User Service (http://localhost:3002)

#### Register a new user
```bash
POST /register
```
Request body:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

#### Login
```bash
POST /login
```
Request body:
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

#### Get all users
```bash
GET /users
```

#### Get a specific user
```bash
GET /users/:id
```

### Product Service (http://localhost:3001)

#### Create a new product
```bash
POST /products
```
Request body:
```json
{
  "name": "Laptop",
  "price": 999.99,
  "description": "Gaming laptop",
  "category": "Electronics"
}
```

#### Get all products
```bash
GET /products
```

#### Get a specific product
```bash
GET /products/:id
```

#### Update a product
```bash
PUT /products/:id
```
Request body:
```json
{
  "name": "Gaming Laptop",
  "price": 1299.99,
  "description": "High-performance gaming laptop",
  "category": "Electronics",
  "inStock": true
}
```

#### Delete a product
```bash
DELETE /products/:id
```

### Main Server (http://localhost:5000)

#### Create a new user (legacy endpoint)
```bash
POST /users
```

#### Get all users (legacy endpoint)
```bash
GET /users
```

## Docker Configuration

The project uses Docker Compose to manage multi-container Docker applications. All services are connected through a custom Docker network (`app-network`) which allows them to communicate with each other.

### Docker Commands

- Start all services: `docker-compose up`
- Start in detached mode: `docker-compose up -d`
- Stop all services: `docker-compose down`
- View logs: `docker-compose logs`
- View running containers: `docker-compose ps`

## Database

All services connect to the same MongoDB instance with the following credentials:
- Username: `root`
- Password: `root`
- Database: `mydb`
- Authentication database: `admin`

## Development

To rebuild a specific service:
```bash
docker-compose build [service-name]
```

To rebuild all services:
```bash
docker-compose build
```

## Testing

You can test the services using curl commands or any HTTP client like Postman.

Example curl command for user registration:
```bash
curl -X POST http://localhost:3002/register \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe", "email":"john@example.com", "password":"password123"}'
```

## Project Structure

```
.
├── docker-compose.yml          # Docker Compose configuration
├── Dockerfile                  # Main server Dockerfile
├── server.js                   # Main server application
├── package.json                # Main server dependencies
├── models/                     # Shared data models
│   ├── User.js                 # User schema
│   └── Product.js              # Product schema
├── mongo-data/                 # MongoDB data persistence
├── product-service/            # Product service directory
│   ├── Dockerfile              # Product service Dockerfile
│   ├── server.js               # Product service application
│   ├── package.json            # Product service dependencies
│   ├── models/                 # Product service models
│   │   └── Product.js          # Product schema
│   └── .dockerignore           # Docker ignore file
├── user-service/               # User service directory
│   ├── Dockerfile              # User service Dockerfile
│   ├── server.js               # User service application
│   ├── package.json            # User service dependencies
│   ├── models/                 # User service models
│   │   └── User.js             # User schema
│   └── .dockerignore           # Docker ignore file
└── .dockerignore               # Docker ignore file for main server
```

## Notes

1. The MongoDB data is persisted in the `mongo-data` directory
2. All services use the same MongoDB database but manage different collections
3. Passwords are stored as plain text for demonstration purposes (not recommended for production)
4. Services communicate through Docker's internal network using service names as hostnames