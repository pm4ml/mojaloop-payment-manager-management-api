.PHONY: build run

NAME=mojaloop-payment-manager-management-api
NPM_TOKEN=Private-Repo-Access-Token

default: build

build:
	docker build --build-arg NPM_TOKEN=${NPM_TOKEN} -t $(NAME) .
run:
	docker-compose up 
