FROM node:20-slim
WORKDIR /bot
COPY bot-server.js ./
# 🗄️ حالة البوت + نظامك الخاص تُحفظ في مجلد دائم — اربط volume حتى لا تضيع عند إعادة التشغيل
#   docker run -d --restart=always -p 8787:8787 -v botdata:/bot/data -e OWNER_CODE=1234 mybot
VOLUME ["/bot/data"]
ENV STATE_FILE=/bot/data/bot-state.json
ENV PRIVATE_FILE=/bot/data/private-system.json
ENV PORT=8787
ENV AUTOSAVE_SEC=20
EXPOSE 8787
HEALTHCHECK --interval=60s --timeout=5s --retries=3 CMD node -e "fetch('http://localhost:'+(process.env.PORT||8787)+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "bot-server.js"]
