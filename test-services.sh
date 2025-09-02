#!/bin/bash

# Test script for FSD Lab Microservices

echo "=== FSD Lab Microservices Test Script ==="
echo ""

# Test User Service
echo "1. Testing User Service"
echo "----------------------"

# Register a new user
echo "Registering a new user..."
curl -s -X POST http://localhost:3002/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice Smith", "email":"alice@example.com", "password":"alice123"}' | jq '.'

echo ""

# Login with the new user
echo "Logging in with the new user..."
curl -s -X POST http://localhost:3002/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com", "password":"alice123"}' | jq '.'

echo ""

# Get all users
echo "Getting all users..."
curl -s http://localhost:3002/users | jq '.'

echo ""
echo ""

# Test Product Service
echo "2. Testing Product Service"
echo "--------------------------"

# Create a new product
echo "Creating a new product..."
curl -s -X POST http://localhost:3001/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Smartphone", "price":699.99, "description":"Latest smartphone", "category":"Electronics"}' | jq '.'

echo ""

# Get all products
echo "Getting all products..."
curl -s http://localhost:3001/products | jq '.'

echo ""
echo ""

# Test Main Server
echo "3. Testing Main Server"
echo "----------------------"

# Get all users from main server
echo "Getting all users from main server..."
curl -s http://localhost:5000/users | jq '.'

echo ""
echo ""

echo "=== Test Completed ==="