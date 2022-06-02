FROM node:16.15

# Create and change to the app directory.
WORKDIR /usr/src/app

# Copy application dependency manifests to the container image.
# A wildcard is used to ensure copying both package.json AND package-lock.json (when available).
# Copying this first prevents re-running npm install on every code change.
COPY package*.json ./

COPY google-service-account.json ./

# Install production dependencies.
# If you add a package-lock.json, speed your build by switching to 'npm ci'.
RUN npm ci --only=production

ENV GOOGLE_APPLICATION_CREDENTIALS=/usr/src/app/google-service-account.json

# Copy local code to the container image.
COPY . ./

# Run the web service on container startup.
CMD [ "node", "app.js" ]
