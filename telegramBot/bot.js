// file: telegram_bot.js
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const helper = require('../helpers/helpers');

// Ваш токен бота
const TOKEN = '7555429120:AAFoLwc1Gncwxsvy_InNIbNrDUlm3NyvvVY';
const bot = new TelegramBot(TOKEN, { polling: true });

// Временное хранилище для данных пользователя
const userData = {};

class Bot {
    async start() {
        const commands = [
            {
                command: 'start',
                description: 'Запуск',
            },
            {
                command: 'cancel',
                description: 'Отменить подписку',
            },
            {
                command: 'all_cancel',
                description: 'Отменить все подписки',
            },
        ];

        await bot.setMyCommands(commands);

        // Шаг 1: Команда /start
        bot.onText(/\/start/, async (msg) => {
            const chatId = msg.chat.id;
            const options = {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: 'Минск - Гомель',
                                callback_data: 'route_Minsk_Gomel',
                            },
                            {
                                text: 'Гомель - Минск',
                                callback_data: 'route_Gomel_Minsk',
                            },
                        ],
                    ],
                },
            };
            await bot.sendMessage(chatId, 'Выберите маршрут:', options);
        });

        // Шаг 2: Обработка выбора маршрута
        bot.on('callback_query', async (query) => {
            const chatId = query.message.chat.id;

            if (query.data.startsWith('route_')) {
                const split = query.data.split('_');
                const route = split[1] + '-' + split[2];
                userData[chatId] = { route };

                await bot.sendMessage(chatId, 'Напишите дату в формате: 12-06');
            }
        });

        // Шаг 3: Получение даты от пользователя
        bot.on('message', async (msg) => {
            const chatId = msg.chat.id;

            if (userData[chatId] && !userData[chatId].date) {
                const date = msg.text.trim();

                // Проверяем формат даты (dd-mm)
                if (!/^\d{2}-\d{2}$/.test(date)) {
                    return bot.sendMessage(
                        chatId,
                        'Дата должна быть в формате: 12-06'
                    );
                }

                userData[chatId].date = date;

                bot.sendMessage(chatId, 'Пожалуйста, подождите...');

                // Запрос к серверу
                try {
                    const times = await helper.getTimeRW(
                        userData[chatId].route,
                        userData[chatId].date
                    );

                    userData[chatId].times = times;

                    // Формируем массив кнопок
                    const timeButtons = times.map((time) => ({
                        text: time,
                        callback_data: `time_${time}`,
                    }));

                    // Форматируем кнопки времени: по две в строку
                    const rows = [];
                    for (let i = 0; i < timeButtons.length; i += 2) {
                        rows.push(timeButtons.slice(i, i + 2)); // Каждая строка содержит максимум 2 кнопки
                    }

                    // Добавляем кнопку подтверждения в отдельной строке по центру
                    rows.push([
                        {
                            text: 'Подтвердить',
                            callback_data: 'confirm',
                        },
                    ]);

                    // Опции для отправки сообщения с кнопками
                    const options = {
                        reply_markup: {
                            inline_keyboard: rows,
                        },
                    };

                    // Отправка сообщения с кнопками
                    bot.sendMessage(chatId, 'Выберите время:', options);
                } catch (error) {
                    console.error(error);
                    bot.sendMessage(chatId, 'Ошибка при запросе на сервер.');
                }
            }
        });

        // Шаг 4: Обработка выбора времени
        bot.on('callback_query', async (query) => {
            const chatId = query.message.chat.id;
            const messageId = query.message.message_id;

            // Извлечение данных
            const data = query.data;

            // Проверяем, если пользователь выбирает время
            if (data.startsWith('time_')) {
                const selectedTime = data.split('_')[1]; // Извлекаем выбранное время

                // Инициализируем выбранные кнопки, если еще нет
                if (!userData[chatId].selectedTimes) {
                    userData[chatId].selectedTimes = [];
                }

                // Обрабатываем выбор: добавляем или убираем из списка
                const index =
                    userData[chatId].selectedTimes.indexOf(selectedTime);
                if (index === -1) {
                    userData[chatId].selectedTimes.push(selectedTime); // Добавляем время
                } else {
                    userData[chatId].selectedTimes.splice(index, 1); // Убираем время
                }

                // Генерируем кнопки заново с отметкой ✅ для выбранных
                const timeButtons = userData[chatId].times.map((time) => ({
                    text: userData[chatId].selectedTimes.includes(time)
                        ? `✅ ${time}`
                        : time,
                    callback_data: `time_${time}`,
                }));

                // Форматируем кнопки времени: по две в строку
                const rows = [];
                for (let i = 0; i < timeButtons.length; i += 2) {
                    rows.push(timeButtons.slice(i, i + 2)); // Каждая строка содержит максимум 2 кнопки
                }

                // Добавляем кнопку подтверждения в отдельной строке по центру
                rows.push([
                    {
                        text: 'Подтвердить',
                        callback_data: 'confirm',
                    },
                ]);

                // Опции для обновления сообщения с кнопками
                const options = {
                    reply_markup: {
                        inline_keyboard: rows,
                    },
                };

                // Обновляем сообщение с новой клавиатурой
                await bot.editMessageReplyMarkup(options.reply_markup, {
                    chat_id: chatId,
                    message_id: messageId,
                });
            }

            // Обрабатываем подтверждение выбора
            if (data === 'confirm') {
                await bot.sendMessage(
                    chatId,
                    'Как только будут билеты, я скажу.'
                );
                if (userData[chatId].selectedTimes.length > 0) {
                    userData[chatId].idInterval = helper.getDataRW(
                        userData[chatId].route,
                        userData[chatId].date,
                        userData[chatId].selectedTimes,
                        async (response) => {
                            response.forEach(async (element) => {
                                await bot.sendMessage(
                                    chatId,
                                    `Есть билет(-ы) на ${element}`
                                );
                            });
                        }
                    );
                } else {
                    await bot.answerCallbackQuery(query.id, {
                        text: 'Сделайте выбор!',
                    });
                }
            }
        });

        // Шаг 5: Кнопка отмены
        bot.onText(/\/cancel/, async (msg) => {
            const chatId = msg.chat.id;

            if (userData[chatId]) {
                if (userData[chatId].idInterval) {
                    clearInterval(userData[chatId].idInterval);
                }

                await bot.sendMessage(chatId, `Отписал.`);

                delete userData[chatId];
            } else {
                await bot.sendMessage(chatId, `Советую запустить бот.`);
            }
        });

        bot.onText(/\/all_cancel/, async (msg) => {
            const chatId = msg.chat.id;

            if (userData[chatId]) {
                for (const key of Object.keys(userData)) {
                    if (userData[key].idInterval) {
                        clearInterval(userData[key].idInterval);
                        await bot.sendMessage(key, `Принудительная отписка.`);
                        delete userData[key];
                    }
                }

                await bot.sendMessage(chatId, `Отписал всех.`);
            } else {
                await bot.sendMessage(chatId, `Советую запустить бот.`);
            }
        });
    }
}

module.exports = new Bot();
