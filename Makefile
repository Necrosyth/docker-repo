# Makefile for FSD Lab Microservices

# Default target
.PHONY: help
help:
	@echo "FSD Lab Microservices - Makefile"
	@echo ""
	@echo "Usage:"
	@echo "  make start     Start all services"
	@echo "  make stop      Stop all services"
	@echo "  make restart   Restart all services"
	@echo "  make logs      View logs for all services"
	@echo "  make build     Build all services"
	@echo "  make test      Run test script"
	@echo "  make clean     Remove all containers and networks"

# Start services
.PHONY: start
start:
	docker-compose up -d

# Stop services
.PHONY: stop
stop:
	docker-compose down

# Restart services
.PHONY: restart
restart:
	docker-compose down
	docker-compose up -d

# View logs
.PHONY: logs
logs:
	docker-compose logs -f

# Build services
.PHONY: build
build:
	docker-compose build

# Run tests
.PHONY: test
test:
	./test-services.sh

# Clean up
.PHONY: clean
clean:
	docker-compose down -v --remove-orphans