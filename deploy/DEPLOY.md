# Lifo4 EMS - Guia de Deploy

## Requisitos do Servidor

- Ubuntu 22.04 LTS
- 3GB RAM (minimo)
- 50GB Disco
- IP Publico

## Passo 1: Preparar o Servidor

Conecte ao servidor via SSH:

```bash
ssh root@76.13.164.252
```

Execute os comandos de instalacao:

```bash
# Atualizar sistema
apt-get update && apt-get upgrade -y

# Instalar dependencias
apt-get install -y curl git htop unzip ufw

# Instalar Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# Instalar Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Verificar instalacao
docker --version
docker-compose --version

# Configurar firewall
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 1883/tcp
ufw --force enable

# Criar swap (importante para 3GB RAM)
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Criar diretorio do projeto
mkdir -p /opt/lifo4-ems
cd /opt/lifo4-ems
```

## Passo 2: Copiar Arquivos

No seu computador local, comprima o projeto:

```bash
cd C:\users\rasec\onedrive\ideiasdenegocio\baterias\ems
tar -czvf lifo4-ems.tar.gz --exclude=node_modules --exclude=.git --exclude=venv .
```

Copie para o servidor:

```bash
scp lifo4-ems.tar.gz root@76.13.164.252:/opt/lifo4-ems/
```

No servidor, extraia:

```bash
cd /opt/lifo4-ems
tar -xzvf lifo4-ems.tar.gz
rm lifo4-ems.tar.gz
```

## Passo 3: Configurar Ambiente

```bash
cd /opt/lifo4-ems/deploy

# Copiar arquivo de exemplo
cp .env.example .env

# Editar configuracoes
nano .env
```

Configure as variaveis importantes:

```env
# Firebase (obtenha no console.firebase.google.com)
FIREBASE_PROJECT_ID=seu-projeto
FIREBASE_PRIVATE_KEY="sua-chave"
FIREBASE_CLIENT_EMAIL=seu-email

# JWT (gere uma chave segura)
JWT_SECRET=sua-chave-super-secreta-aqui

# Atualize o IP
VITE_API_URL=http://76.13.164.252/api
VITE_WS_URL=ws://76.13.164.252
```

## Passo 4: Criar Diretorios Necessarios

```bash
mkdir -p mosquitto/data mosquitto/log
mkdir -p certbot/www certbot/conf
chmod -R 777 mosquitto/
```

## Passo 5: Build e Deploy

```bash
cd /opt/lifo4-ems/deploy

# Build das imagens
docker-compose -f docker-compose.prod.yml build

# Iniciar servicos
docker-compose -f docker-compose.prod.yml up -d

# Ver logs
docker-compose -f docker-compose.prod.yml logs -f
```

## Passo 6: Verificar

```bash
# Status dos containers
docker-compose -f docker-compose.prod.yml ps

# Testar endpoints
curl http://localhost/health
curl http://localhost/api/health
```

Acesse no navegador: http://76.13.164.252

## Comandos Uteis

```bash
# Ver logs de um servico especifico
docker-compose -f docker-compose.prod.yml logs -f backend

# Reiniciar um servico
docker-compose -f docker-compose.prod.yml restart backend

# Parar tudo
docker-compose -f docker-compose.prod.yml down

# Atualizar apos mudancas
docker-compose -f docker-compose.prod.yml up -d --build

# Limpar imagens antigas
docker system prune -a
```

## Monitoramento

```bash
# Uso de recursos
docker stats

# Espaco em disco
df -h

# Memoria
free -h

# Processos
htop
```

## Troubleshooting

### Container nao inicia

```bash
# Ver logs detalhados
docker-compose -f docker-compose.prod.yml logs backend
```

### Erro de memoria

```bash
# Verificar swap
swapon --show

# Reiniciar servicos com menos memoria
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

### Porta ocupada

```bash
# Ver o que esta usando a porta
lsof -i :80
netstat -tlnp | grep 80

# Matar processo
kill -9 PID
```

## SSL/HTTPS (Futuro)

Quando tiver um dominio:

```bash
# Instalar certbot
apt-get install certbot

# Gerar certificado
certbot certonly --webroot -w /opt/lifo4-ems/deploy/certbot/www -d seu-dominio.com

# Atualizar nginx config para HTTPS
```
