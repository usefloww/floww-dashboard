# Build Docker image (tests the Dockerfile)
build-docker:
    docker build -t floww-dashboard:test .
    docker run --rm -p 3000:3000 floww-dashboard:test

