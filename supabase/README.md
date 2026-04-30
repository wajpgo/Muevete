# 🚍 Muévete! - Guía de Despliegue en VPS (Hosting del Caribe)

Esta guía te permite desplegar **Muévete!** en un VPS de **Hosting del Caribe** usando Docker y **Supabase Self-Hosted**, logrando un entorno 100% independiente para el transporte en La Habana.

---

## 🏗 Requisitos del VPS
- **OS**: Ubuntu 22.04 LTS.
- **RAM**: Recomendado 4GB+ (Supabase + Next.js). Mínimo 2GB con Swap configurado.
- **Dominios**: 
  - `muevete-cuba.com` (Frontend).
  - `api.muevete-cuba.com` o `db.muevete-cuba.com` (Supabase).
- Puertos abiertos en Firewall: `80` (HTTP), `443` (HTTPS), `22` (SSH).

## 🛠 Paso 1: Preparación del VPS

1. **Conéctate por SSH**:
   ```bash
   ssh root@TU_IP_VPS
   ```

2. **Actualiza e instala Docker + Docker Compose**:
   ```bash
   apt update && apt upgrade -y
   apt install docker.io docker-compose git nginx certbot python3-certbot-nginx -y
   systemctl enable --now docker
   ```

## 🗄 Paso 2: Configurar Supabase Self-Hosted

Supabase tiene muchos componentes. Para simplificar, hemos creado un `docker-compose.yml` en la carpeta `/supabase`.

1. **Clonar este repositorio en el VPS**:
   ```bash
   git clone https://github.com/tu-usuario/muevete.git /opt/muevete
   cd /opt/muevete/supabase
   ```

2. **Configurar Variables de Entorno**:
   Copia el archivo de ejemplo:
   ```bash
   cp .env.example .env
   ```
   Edita `.env` con un editor como `nano .env`. Genera contraseñas fuertes para `POSTGRES_PASSWORD`, `JWT_SECRET` y los tokens anon/service_role. Puedes generarlos aquí: https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys

3. **Arrancar Supabase**:
   ```bash
   docker-compose up -d
   ```
   *Esto descargará las imágenes (Kong, PostgREST, GoTrue, Realtime, DB) e iniciará tu backend.*

## 🚀 Paso 3: Despliegue del Frontend

*Nota: Esta estructura en AI Studio usa Vite para la vista previa, pero la lógica de componentes es idéntica en Next.js. El `docker-compose.yml` también asume un Dockerfile del frontend.*

Para poner el Frontend en marcha (Si usas un servidor Node o sirves la carpeta `dist` con Nginx):

```bash
cd /opt/muevete
npm install
npm run build
```

## 🔒 Paso 4: Nginx Reverse Proxy y SSL (Let's Encrypt)

1. **Configurar el dominio del Frontend**:
   Crea el archivo `/etc/nginx/sites-available/muevete`:
   ```nginx
   server {
       listen 80;
       server_name muevete-cuba.com;
       location / {
           root /opt/muevete/dist;
           try_files $uri $uri/ /index.html;
       }
   }
   ```

2. **Configurar el dominio de Supabase (API)**:
   Crea `/etc/nginx/sites-available/supabase`:
   ```nginx
   server {
       listen 80;
       server_name db.muevete-cuba.com;
       location / {
           proxy_set_header Host $host;
           proxy_pass http://localhost:8000; # Apunta a Kong Gateway
       }
   }
   ```

3. **Activar sitios y SSL**:
   ```bash
   ln -s /etc/nginx/sites-available/muevete /etc/nginx/sites-enabled/
   ln -s /etc/nginx/sites-available/supabase /etc/nginx/sites-enabled/
   nginx -t
   systemctl restart nginx
   certbot --nginx -d muevete-cuba.com -d db.muevete-cuba.com
   ```

## 🗺 Paso 5: "Seed" de la Base de Datos

Entra a tu Supabase Studio (usualmente puerto `:3000` del stack de Supabase si lo activas, o ejecuta las queries por CLI).
En este repo, tienes `supabase/seed.sql` con las rutas de La Habana y el esquema de seguridad (RLS).

```bash
cat supabase/schema.sql | docker exec -i supabase-db psql -U postgres
cat supabase/seed.sql | docker exec -i supabase-db psql -U postgres
```

---

¡Listo! Ya tienes "Muévete!" corriendo en Cuba. 🚍
