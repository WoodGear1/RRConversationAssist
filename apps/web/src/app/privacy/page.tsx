export default function PrivacyPage() {
  return (
    <main className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Политика конфиденциальности</h1>
      
      <div className="prose prose-invert max-w-none space-y-4">
        <section>
          <h2 className="text-2xl font-semibold mb-3">1. Сбор информации</h2>
          <p className="text-muted-foreground">
            Мы собираем следующую информацию:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
            <li>Данные учетной записи (email, пароль в зашифрованном виде)</li>
            <li>Информация о Discord аккаунте (ID, имя пользователя, аватар)</li>
            <li>Записанные аудиофайлы и их транскрипции</li>
            <li>Метаданные записей (время, участники, длительность)</li>
            <li>Логи использования сервиса</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">2. Использование информации</h2>
          <p className="text-muted-foreground">
            Собранная информация используется для:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
            <li>Предоставления и улучшения сервиса</li>
            <li>Обработки записей и генерации транскрипций</li>
            <li>Обеспечения безопасности и предотвращения злоупотреблений</li>
            <li>Соблюдения юридических обязательств</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">3. Хранение данных</h2>
          <p className="text-muted-foreground">
            Данные хранятся на защищенных серверах. Аудиофайлы хранятся в зашифрованном виде
            в объектном хранилище. Мы принимаем меры для защиты данных от несанкционированного доступа.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">4. Доступ к данным</h2>
          <p className="text-muted-foreground">
            Доступ к вашим записям имеют только вы и пользователи, которым вы предоставили доступ.
            Администраторы сервиса имеют технический доступ к данным для обеспечения работы сервиса,
            но не используют их в личных целях.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">5. Удаление данных</h2>
          <p className="text-muted-foreground">
            Вы можете удалить свои записи в любое время через интерфейс сервиса.
            При удалении аккаунта все связанные данные будут удалены в течение 30 дней.
            Некоторые данные могут храниться дольше для соблюдения юридических обязательств.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">6. Передача данных третьим лицам</h2>
          <p className="text-muted-foreground">
            Мы не продаем и не передаем ваши персональные данные третьим лицам, за исключением:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
            <li>Поставщиков услуг (хостинг, обработка аудио через OpenAI API)</li>
            <li>По требованию закона или судебных органов</li>
            <li>С вашего явного согласия</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">7. Cookies и технологии отслеживания</h2>
          <p className="text-muted-foreground">
            Мы используем cookies для обеспечения работы сервиса и улучшения пользовательского опыта.
            Вы можете отключить cookies в настройках браузера, но это может повлиять на функциональность сервиса.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">8. Ваши права</h2>
          <p className="text-muted-foreground">
            Вы имеете право:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
            <li>Получить доступ к своим данным</li>
            <li>Исправить неточные данные</li>
            <li>Удалить свои данные</li>
            <li>Ограничить обработку данных</li>
            <li>Подать жалобу в надзорный орган</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">9. Изменения политики</h2>
          <p className="text-muted-foreground">
            Мы можем обновлять данную политику конфиденциальности. О существенных изменениях
            мы уведомим вас через сервис или по email.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">10. Контакты</h2>
          <p className="text-muted-foreground">
            По вопросам конфиденциальности обращайтесь через форму обратной связи
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
