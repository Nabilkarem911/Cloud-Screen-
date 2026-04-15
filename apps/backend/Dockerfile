# syntax=docker/dockerfile:1
FROM node:20 AS builder
WORKDIR /app

# نسخ ملفات تعريف الـ Workspaces
COPY package*.json ./
COPY packages ./packages
COPY apps/backend/package*.json ./apps/backend/

# تثبيت الاعتمادات
RUN npm install

# نسخ كود الباكاند
COPY apps/backend ./apps/backend

# متغير بيئة وهمي لعملية البناء فقط
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"

# توليد Prisma Client (تصحيح: استخدام npx و --schema)
RUN npx prisma generate --schema=apps/backend/prisma/schema.prisma

# بناء مشروع الباكاند
RUN npm run build --workspace=backend

FROM node:20-alpine
WORKDIR /app

# تثبيت مكتبات النظام الضرورية
RUN apk add --no-cache openssl libc6-compat

ENV NODE_ENV=production

# نسخ الملفات من مرحلة البناء
COPY --from=builder /app ./

# فتح المنفذ (Railway PORT)
EXPOSE 3000

# اختبار الصحة (Healthcheck)
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=6 \
  CMD node -e "const p=Number(process.env.PORT||3000);require('http').get('http://127.0.0.1:'+p+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# أمر التشغيل النهائي (تصحيح: migrate deploy مع npx والمسار الصحيح)
CMD ["sh", "-c", "npx prisma migrate deploy --schema=apps/backend/prisma/schema.prisma && npm run start:prod --workspace=backend"]
