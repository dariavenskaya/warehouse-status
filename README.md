## Plan

1. Make laptop model, history, statuses enum
2. Create transition map and fix sold date
3. Add unit test for allowed or forbidden transitions and edge case (14 days return)

### To check:

```bash
  npm install
```

```bash
  npm run test
```

### Что в задании было непонятно и как вы это решили?

Задание было понятно, я описала модель и общую схему что функция принимает и возвращает, оставив отдельные пункты реализации ИИ.

### Какие запросы вы давали AI?

1. Hey Grok! Look at my setup. I need you to follow my code style and implement changeStatus function that will change laptop status according to this map:
   "На складе → Бронь, Продан, СписанБронь → На складе, ПроданПродан → На складе (возврат не позднее 14 дней после продажи)Списан — дальше никуда"
   If transition is impossible - throw with a human readable message.
   Write every transition to history.
   Using jest add test cases for every basic case and edge case. Check errors and correct history.

2. fix my jest config to use ts correctly.
