if [ ! -f .env ]; then
    cp .env.format .env
fi

npm install