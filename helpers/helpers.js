const axios = require('axios');
const cheerio = require('cheerio');

class Helper {
    async getTimeRW(route, date) {
        const html = await this.#getRW(route, date);

        const timetableRW = this.#timetableRW(html);

        return timetableRW;
    }

    getDataRW(route, date, time, callback) {
        const intervalId = setInterval(async () => {
            const html = await this.#getRW(route, date);

            const refactTime = time.map((time) => {
                return time.split('-')[0].trim();
            });

            const response = this.#timetableRW(html, refactTime);

            callback(response);
        }, 1_000 * 60 * 5);

        return intervalId;
    }

    async #getRW(route, date) {
        const url = 'https://pass.rw.by/ru/route/';

        const from = route.split('-')[0];
        const to = route.split('-')[1];

        const currentYear = new Date().getFullYear();
        const [day, month] = date.split('-');
        const formattedDate = `${currentYear}-${month.padStart(
            2,
            '0'
        )}-${day.padStart(2, '0')}`;

        const params = {
            from: from === 'Gomel' ? 'Гомель' : 'Минск',
            from_exp: from === 'Gomel' ? '2100100' : '2100000',
            from_esr: from === 'Gomel' ? '150000' : '140210',
            to: to === 'Gomel' ? 'Гомель' : 'Минск',
            to_exp: to === 'Gomel' ? '2100100' : '2100000',
            to_esr: to === 'Gomel' ? '150000' : '140210',
            date: formattedDate,
        };

        const response = await axios.get(url, { params });

        if (response.status !== 200) {
            throw new Error();
        }

        return response.data;
    }

    #timetableRW(html, time = null) {
        const result = [];
        const $ = cheerio.load(html);

        $('.sch-table__row').each((_, row) => {
            const departureTime = $(row).find('.train-from-time').text().trim();

            if (time) {
                const noSeatsText = $(row)
                    .find('.sch-table__no-info')
                    .text()
                    .trim();

                time.forEach((time) => {
                    if (departureTime === time) {
                        if (!noSeatsText.includes('Мест нет')) {
                            result.push(time);
                        }
                    }
                });
            } else {
                const duration = $(row)
                    .find('.train-duration-time')
                    .text()
                    .trim();
                if (departureTime !== '') {
                    result.push(departureTime + ' - ' + duration);
                }
            }
        });

        return result;
    }
}

module.exports = new Helper();
