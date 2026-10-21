FROM node:20-slim
WORKDIR /bot
COPY bot-server.js hq-entry.js ./
# حالة الروبوت تُحفظ في bot-state.json — اربط مجلداً دائماً (volume) حتى لا تضيع عند إعادة التشغيل
RUN mkdir -p /bot/data && chown -R node:node /bot
VOLUME ["/bot/data"]
ENV STATE_FILE=/bot/data/bot-state.json \
    SECURITY_MAX_STAKE_USD=10 \
    SECURITY_MAX_TRADES=3 \
    SECURITY_MAX_DAILY_LOSS=10 \
    SECURITY_REQUIRE_IP=1
USER node
CMD ["node", "bot-server.js"]
