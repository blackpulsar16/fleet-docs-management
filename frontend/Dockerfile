# Etapa 1: Construcción (Build) usando Node.js
FROM node:20-alpine AS build
WORKDIR /app

# Copiamos solo los archivos de dependencias primero para aprovechar la caché de Docker
COPY package.json package-lock.json ./
RUN npm ci

# Variables de Vite (inyectadas desde el .env raíz vía docker-compose build args)
ARG VITE_AUTHENTIK_AUTHORITY
ARG VITE_AUTHENTIK_CLIENT_ID
ARG VITE_AUTHENTIK_REDIRECT_URI
ENV VITE_AUTHENTIK_AUTHORITY=$VITE_AUTHENTIK_AUTHORITY
ENV VITE_AUTHENTIK_CLIENT_ID=$VITE_AUTHENTIK_CLIENT_ID
ENV VITE_AUTHENTIK_REDIRECT_URI=$VITE_AUTHENTIK_REDIRECT_URI

# Copiamos el resto del código y construimos la aplicación
COPY . .
RUN npm run build

# Etapa 2: Servidor web ligero (Nginx) para Producción
FROM nginx:alpine

# Copiamos nuestra configuración optimizada de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiamos los archivos estáticos generados en la etapa anterior (Vite genera en la carpeta /dist)
COPY --from=build /app/dist /usr/share/nginx/html

# Exponemos el puerto 80
EXPOSE 80

# Comando para iniciar Nginx
CMD ["nginx", "-g", "daemon off;"]
