export default function TermsPage() {
  return (
    <main className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Условия использования</h1>
      
      <div className="prose prose-invert max-w-none space-y-4">
        <section>
          <h2 className="text-2xl font-semibold mb-3">1. Общие положения</h2>
          <p className="text-muted-foreground">
            Настоящие Условия использования регулируют отношения между пользователем и сервисом RRConversationAssist.
            Используя сервис, вы соглашаетесь с данными условиями.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">2. Использование сервиса</h2>
          <p className="text-muted-foreground">
            Сервис предназначен для записи, обработки и анализа голосовых разговоров в Discord.
            Вы обязуетесь использовать сервис только в законных целях и в соответствии с применимым законодательством.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">3. Запись разговоров</h2>
          <p className="text-muted-foreground">
            Запись разговоров осуществляется только с согласия всех участников.
            Вы несете ответственность за получение необходимых разрешений перед началом записи.
            Сервис не несет ответственности за незаконную запись разговоров.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">4. Конфиденциальность</h2>
          <p className="text-muted-foreground">
            Все записанные данные обрабатываются в соответствии с нашей Политикой конфиденциальности.
            Мы принимаем меры для защиты ваших данных, но не можем гарантировать абсолютную безопасность.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">5. Ограничение ответственности</h2>
          <p className="text-muted-foreground">
            Сервис предоставляется "как есть". Мы не гарантируем бесперебойную работу сервиса
            и не несем ответственности за любые убытки, возникшие в результате использования сервиса.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">6. Изменения условий</h2>
          <p className="text-muted-foreground">
            Мы оставляем за собой право изменять данные условия в любое время.
            Изменения вступают в силу с момента публикации на сайте.
            Продолжение использования сервиса после изменений означает ваше согласие с новыми условиями.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">7. Контакты</h2>
          <p className="text-muted-foreground">
            По вопросам, связанным с условиями использования, обращайтесь через форму обратной связи
            или на электронную почту поддержки.
          </p>
        </section>

        <p className="text-sm text-muted-foreground mt-8">
          Последнее обновление: {new Date().toLocaleDateString('ru-RU')}
        </p>
      </div>
    </main>
  )
}
