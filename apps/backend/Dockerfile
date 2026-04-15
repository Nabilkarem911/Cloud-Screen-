# 1. المرحلة الأولى: البناء (Build)
FROM node:20-alpine AS builder

WORKDIR /app

# نسخ ملفات التعريف أولاً لسرعة الـ Cache
COPY package*.json ./
COPY prisma ./prisma/

# تثبيت جميع المكتبات بما فيها الـ devDependencies للبناء
RUN npm install

# نسخ باقي ملفات المشروع
COPY . .

# توليد ملفات Prisma Client (بدون أوامر Config معقدة)
RUN npx prisma generate

# بناء المشروع
RUN npm run build

# 2. المرحلة الثانية: التشغيل (Production)
FROM node:20-alpine

WORKDIR /app

# نسخ الملفات الضرورية فقط من مرحلة البناء لتقليل مساحة الصورة
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

# التأكد من وجود المتغيرات من ريلواي
ENV NODE_ENV=production

# فتح المنفذ (المنفذ الافتراضي لريلواي)
EXPOSE 3000

# أمر التشغيل: بيعمل Push للسكيما الأول وبعدين يشغل السيرفر
# ده بيضمن إن الـ Healthcheck ينجح لأن الداتابيز هتكون جاهزة
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/src/main.js"]
