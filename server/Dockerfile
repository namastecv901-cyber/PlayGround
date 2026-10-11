FROM node:20-slim
WORKDIR /bot
COPY bot-server.js ./
# حالة الروبوت تُحفظ في bot-state.json — اربط مجلداً دائماً (volume) حتى لا تضيع عند إعادة التشغيل
VOLUME ["/bot/data"]
ENV STATE_FILE=/bot/data/bot-state.json
CMD ["node", "bot-server.js"]
