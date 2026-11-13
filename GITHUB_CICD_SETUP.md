# JobDraftly Linux VPS setup and GitHub deployment

This guide installs JobDraftly beside the VPS's existing applications without changing `/var/www/fastsitecheck`, `/var/www/newswebsite`, `/var/www/youtube.fastsitecheck.com`, or existing Nginx server blocks. JobDraftly uses its own directory, Linux user, port, database, Redis key prefix, systemd services, backup directory, and Nginx hostname.

The examples use `jobs.example.com`. Replace it everywhere with the real subdomain before issuing a certificate. The application listens only on `127.0.0.1:3100`; Nginx owns public ports 80 and 443.

## 1. Record the current VPS state

Run these read-only checks as root and save the output before changing anything:

```bash
nginx -T > /root/nginx-before-jobdraftly.txt
systemctl --type=service --state=running > /root/services-before-jobdraftly.txt
ss -lntup > /root/ports-before-jobdraftly.txt
df -h
free -h
node --version || true
mysql --version || true
redis-server --version || true
```

Do not restore or delete `261002-121131.bak` or `fastsitecheck-nginx-20261002-112206.bak`; they appear to belong to existing applications. This setup does not use them.

## 2. Install required packages

On Ubuntu/Debian:

```bash
apt update
apt install -y curl ca-certificates gnupg xz-utils nginx redis-server certbot python3-certbot-nginx
```

The VPS currently has Node.js 20. Do not replace it globally because an existing application may depend on it. Install the current Node.js 22 LTS binary side-by-side for JobDraftly after confirming `uname -m` prints `x86_64`:

```bash
cd /tmp
curl -fSLO https://nodejs.org/dist/v22.23.5/node-v22.23.5-linux-x64.tar.xz
curl -fSLO https://nodejs.org/dist/v22.23.5/SHASUMS256.txt
grep ' node-v22.23.5-linux-x64.tar.xz$' SHASUMS256.txt | sha256sum -c -
tar -xJf node-v22.23.5-linux-x64.tar.xz -C /opt
ln -sfn /opt/node-v22.23.5-linux-x64 /opt/node22
/opt/node22/bin/node --version
/opt/node22/bin/npm --version
```

The expected Node result is `v22.23.5`. Existing applications continue using the unchanged `/usr/bin/node` version.

The VPS already has MariaDB tooling. Do not install `mysql-server` beside it. First verify the actual database server and dump utility:

```bash
mariadb -NBe "SELECT VERSION(), @@port, @@character_set_server, @@collation_server;"
systemctl is-active mariadb
command -v mariadb-dump mysqldump
```

Enable local Redis. A local URL is accepted without TLS because it never leaves loopback:

```bash
systemctl enable --now redis-server
redis-cli ping
```

The expected response is `PONG`.

## 3. Create the isolated database

Open MySQL as an administrator:

```bash
mysql
```

Run the following SQL after replacing the password:

```sql
CREATE DATABASE jobdraftly
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'jobdraftly_app'@'127.0.0.1'
  IDENTIFIED BY 'replace-with-a-long-random-password';

GRANT ALL PRIVILEGES ON jobdraftly.*
  TO 'jobdraftly_app'@'127.0.0.1';

FLUSH PRIVILEGES;
EXIT;
```

MariaDB 11.8 is supported by Prisma 7's MySQL connector. The deployment still applies all committed migrations to the new, empty `jobdraftly` database before switching traffic; a migration failure stops deployment without touching the other databases.

Test the account without placing its password in shell history:

```bash
mysql -h 127.0.0.1 -u jobdraftly_app -p jobdraftly
```

Exit with `quit` after it connects.

## 4. Create the Linux user and directories

```bash
adduser --disabled-password --gecos "" jobdraftly
install -d -o jobdraftly -g jobdraftly /var/www/jobdraftly/releases
install -d -o jobdraftly -g jobdraftly /var/backups/jobdraftly
install -d -m 750 -o root -g jobdraftly /etc/jobdraftly
```

Allow this user to restart only its two services:

```bash
cat >/etc/sudoers.d/jobdraftly <<'EOF'
jobdraftly ALL=(root) NOPASSWD: /usr/bin/systemctl restart jobdraftly-app.service
jobdraftly ALL=(root) NOPASSWD: /usr/bin/systemctl restart jobdraftly-worker.service
jobdraftly ALL=(root) NOPASSWD: /usr/bin/systemctl stop jobdraftly-worker.service jobdraftly-app.service
EOF
chmod 440 /etc/sudoers.d/jobdraftly
visudo -cf /etc/sudoers.d/jobdraftly
```

Confirm where Node was installed:

```bash
command -v node
```

The supplied deployment and systemd files use `/opt/node22/bin/node` so existing applications can remain on Node.js 20.

## 5. Create the protected environment file

Create `/etc/jobdraftly/jobdraftly.env`:

```bash
nano /etc/jobdraftly/jobdraftly.env
```

Use this template, replacing every placeholder and `jobs.example.com`:

```dotenv
NODE_ENV=production
DATABASE_URL=mysql://jobdraftly_app:URL_ENCODED_PASSWORD@127.0.0.1:3306/jobdraftly
NEXTAUTH_SECRET=REPLACE_WITH_RANDOM_SECRET_1
NEXTAUTH_URL=https://jobs.example.com
NEXT_PUBLIC_SITE_URL=https://jobs.example.com
NEXT_PUBLIC_CONTACT_EMAIL=you@example.com
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=
NEXT_PUBLIC_GA_MEASUREMENT_ID=
CRON_SECRET=REPLACE_WITH_DIFFERENT_RANDOM_SECRET_2
APP_RELEASE=

REDIS_URL=redis://127.0.0.1:6379
REDIS_KEY_PREFIX=jobdraftly:production
WORKER_POLL_INTERVAL_MS=60000
MONITOR_SOURCE_BATCH_SIZE=10
EXPIRY_INTERVAL_MINUTES=15

# Configure either CLOUDINARY_URL or every OBJECT_STORAGE_* value.
CLOUDINARY_URL=cloudinary://REAL_KEY:REAL_SECRET@REAL_CLOUD_NAME
CLOUDINARY_FOLDER=jobdraftly

ANTHROPIC_API_KEY=
AI_EXTRACTION_MODEL=claude-opus-5-5
AI_AUTO_PUBLISH_MIN_CONFIDENCE=0.85
AI_DEFAULT_LISTING_DAYS=30
AI_PUBLISH_BATCH_SIZE=10
AI_EXTRACTION_WEBHOOK_URL=
AI_EXTRACTION_WEBHOOK_SECRET=

MYSQL_BIN_DIR=/usr/bin
BACKUP_DIRECTORY=/var/backups/jobdraftly
BACKUP_RETENTION_DAYS=14
BACKUP_FAILURE_WEBHOOK_URL=
```

Generate the two independent secrets:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

URL-encode reserved characters in the MySQL password. For example, `@` is `%40`, `#` is `%23`, and `%` is `%25`. Protect the file:

```bash
chown root:jobdraftly /etc/jobdraftly/jobdraftly.env
chmod 640 /etc/jobdraftly/jobdraftly.env
```

Do not copy this file into the Git repository or GitHub Actions secrets. It remains on the VPS.

## 6. Install systemd services

From a checked-out copy of this repository, or by copying the files from the repository:

```bash
cp ops/systemd/jobdraftly-app.service.example /etc/systemd/system/jobdraftly-app.service
cp ops/systemd/jobdraftly-worker.service.example /etc/systemd/system/jobdraftly-worker.service
systemctl daemon-reload
systemctl enable jobdraftly-app.service jobdraftly-worker.service
```

Do not start them yet; `/var/www/jobdraftly/current` will be created by the first deployment.

## 7. Add the isolated Nginx hostname

Create a DNS `A` record such as `jobs.example.com` pointing to the VPS IP. Do not change the DNS records for existing applications.

Install the supplied Nginx file and replace the placeholder hostname:

```bash
cp ops/nginx/jobdraftly.conf.example /etc/nginx/sites-available/jobdraftly
sed -i 's/jobs\.example\.com/YOUR_REAL_SUBDOMAIN/g' /etc/nginx/sites-available/jobdraftly
ln -s /etc/nginx/sites-available/jobdraftly /etc/nginx/sites-enabled/jobdraftly
nginx -t
systemctl reload nginx
```

`nginx -t` must succeed before reloading. Request TLS only after DNS resolves to this server:

```bash
certbot --nginx -d YOUR_REAL_SUBDOMAIN
certbot renew --dry-run
```

Certbot edits only the matching JobDraftly server block when the hostname is unique.

## 8. Configure SSH for GitHub Actions

Create an SSH key dedicated to this deployment:

```bash
sudo -u jobdraftly mkdir -p /home/jobdraftly/.ssh
sudo -u jobdraftly chmod 700 /home/jobdraftly/.ssh
ssh-keygen -t ed25519 -C jobdraftly-github-actions -f /root/jobdraftly_github -N ''
cat /root/jobdraftly_github.pub >> /home/jobdraftly/.ssh/authorized_keys
chown jobdraftly:jobdraftly /home/jobdraftly/.ssh/authorized_keys
chmod 600 /home/jobdraftly/.ssh/authorized_keys
```

Test the key from another machine before relying on CI. After GitHub is configured, securely delete `/root/jobdraftly_github` from the VPS; GitHub should hold the deployment copy of the private key.

In the GitHub repository, create an environment named `production` under **Settings -> Environments** and add required reviewers. Add these environment secrets:

| Secret | Value |
| --- | --- |
| `VPS_HOST` | VPS IP address or SSH hostname |
| `VPS_USER` | `jobdraftly` |
| `VPS_SSH_PRIVATE_KEY` | Entire contents of `/root/jobdraftly_github` |
| `VPS_KNOWN_HOSTS` | Output from a trusted `ssh-keyscan` verification |

Generate a temporary known-hosts file on a trusted machine and compare its fingerprint with the host key shown directly on the VPS:

```bash
ssh-keyscan -t ed25519 YOUR_VPS_IP > jobdraftly_known_hosts
ssh-keygen -lf jobdraftly_known_hosts

# Run this second command on the VPS and compare the SHA256 fingerprint:
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

After the fingerprints match, save the entire contents of `jobdraftly_known_hosts` as `VPS_KNOWN_HOSTS`.

If SSH does not use port 22, add an Actions variable named `VPS_SSH_PORT`.

## 9. First deployment

Push the repository and merge a reviewed pull request into `main`. The workflow will:

1. Run lint, type-check, migrations, tests, and build against an isolated MySQL 8 CI service.
2. Upload a source archive over SSH.
3. Build an immutable release under `/var/www/jobdraftly/releases` using the protected VPS environment.
4. Back up MySQL, apply committed migrations, and load reference data.
5. Atomically update `/var/www/jobdraftly/current`.
6. Restart only `jobdraftly-app.service` and `jobdraftly-worker.service`.
7. Check the live, database-ready, and worker endpoints on port 3100.
8. Restore the previous application symlink if health checks fail. Database migrations are never automatically reversed.

Watch the first deployment in **GitHub -> Actions -> CI and deploy**. On the VPS, inspect:

```bash
systemctl status jobdraftly-app.service --no-pager
systemctl status jobdraftly-worker.service --no-pager
journalctl -u jobdraftly-app.service -n 100 --no-pager
journalctl -u jobdraftly-worker.service -n 100 --no-pager
curl -fsS http://127.0.0.1:3100/api/health/live
curl -fsS http://127.0.0.1:3100/api/health/ready
curl -fsS http://127.0.0.1:3100/api/health/worker
```

## 10. Create the first administrator

After the first healthy deployment:

```bash
cd /var/www/jobdraftly/current
read -rp 'Admin name: ' ADMIN_NAME
read -rp 'Admin email: ' ADMIN_EMAIL
read -srp 'Admin password: ' ADMIN_PASSWORD; echo
export ADMIN_NAME ADMIN_EMAIL ADMIN_PASSWORD
node --env-file=/etc/jobdraftly/jobdraftly.env --import tsx scripts/create-admin.ts
unset ADMIN_NAME ADMIN_EMAIL ADMIN_PASSWORD
```

Then sign in at `https://YOUR_REAL_SUBDOMAIN/admin/login`.

## 11. Verify existing applications were not affected

```bash
nginx -t
systemctl is-active nginx
ss -lntp | grep -E ':80|:443|:3100'
curl -I https://YOUR_EXISTING_FASTSITECHECK_DOMAIN
curl -I https://YOUR_REAL_SUBDOMAIN
```

The only new application listener should be loopback port 3100. Existing Nginx hostnames continue routing to their original upstreams.

## 12. Rollback and maintenance

The deployment script automatically restores the previous application release when a health check fails. For a manual application rollback:

```bash
systemctl stop jobdraftly-worker.service jobdraftly-app.service
readlink -f /var/www/jobdraftly/current
ln -sfn /var/www/jobdraftly/releases/KNOWN_HEALTHY_RELEASE /var/www/jobdraftly/current
systemctl start jobdraftly-app.service jobdraftly-worker.service
```

Verify all three health endpoints afterward. Do not reverse database migrations automatically. Use the reviewed procedure in `BACKUP_RESTORE.md` for database recovery.

Old release directories are intentionally not automatically deleted. After confirming a release is healthy and backed up, retain at least the current and previous releases and remove older directories only after verifying their exact resolved paths under `/var/www/jobdraftly/releases`.

## Common failures

- **Nginx reports a duplicate server name:** another file already uses the chosen hostname. Choose a unique subdomain; do not overwrite the existing block.
- **Port 3100 is busy:** run `ss -lntp | grep :3100`, choose an unused loopback port, and change it in the systemd app service, `ops/linux/deploy-release.sh`, and Nginx.
- **Preflight reports missing storage:** configure real Cloudinary credentials or all S3-compatible `OBJECT_STORAGE_*` variables.
- **Backup fails:** verify `/usr/bin/mysqldump`, database privileges, and ownership of `/var/backups/jobdraftly`.
- **Worker health remains 503:** inspect the worker journal and verify `redis-cli ping`, `REDIS_URL`, and `REDIS_KEY_PREFIX`.
- **SSH deployment cannot restart services:** run `visudo -cf /etc/sudoers.d/jobdraftly` and test the exact allowed `sudo -n systemctl ...` command as the `jobdraftly` user.
- **Build cannot download Google fonts:** allow outbound HTTPS to `fonts.googleapis.com` and `fonts.gstatic.com`, or replace the existing Google font imports with self-hosted fonts.
