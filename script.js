var reservationQueue = [];

let NARIJE_TOKEN = '';

const BASE_API_URL = 'https://api.narijeh.com';

function saveTokenToStorate(token, expire) {
    const expireDate = Date.now() + expire * 1000;

    localStorage.setItem('USER_TOKEN', token);

    localStorage.setItem('TOKEN_EXPIRE_DATE', expireDate);
}

function getTokenFromStorate() {
    const token = localStorage.getItem('USER_TOKEN');

    if (!token) return;

    const expireDate = localStorage.getItem('TOKEN_EXPIRE_DATE');

    if (!expireDate || expireDate < Date.now()) return;

    return token;
}

function handleLogout() {
    localStorage.clear();

    window.location.reload();
}

function toggleLogoutButton(show) {
    const logoutButton = $('#logout-button');

    if (show) {
        logoutButton.removeClass('d-none');
        logoutButton.on('click', handleLogout);
        return;
    }

    logoutButton.addClass('d-none');
    logoutButton.off('click', handleLogout);
}

// TODO: Handle 401 or 403 error
async function fetchApi({ url, method = 'GET', headers, body }) {
    return fetch(`${BASE_API_URL}/${url}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });
}

function toJalali(date) {
    const gregorianDate = new Date(date);
    const jalaaliDate = jalaali.toJalaali(gregorianDate);
    const monthNames = [
        'فروردین',
        'اردیبهشت',
        'خرداد',
        'تیر',
        'مرداد',
        'شهریور',
        'مهر',
        'آبان',
        'آذر',
        'دی',
        'بهمن',
        'اسفند',
    ];
    const weekDay = gregorianDate.toLocaleDateString('en-US', {
        weekday: 'long',
    });
    const weekDays = {
        Saturday: 'شنبه',
        Sunday: 'یکشنبه',
        Monday: 'دوشنبه',
        Tuesday: 'سه‌شنبه',
        Wednesday: 'چهارشنبه',
        Thursday: 'پنج‌شنبه',
        Friday: 'جمعه',
    };
    const jalaaliWeekDay = weekDays[weekDay];
    const month = monthNames[jalaaliDate.jm - 1];
    return `${jalaaliWeekDay} ${jalaaliDate.jd} ${
        monthNames[jalaaliDate.jm - 1]
    }`;
}

function selectFood(foodId, day) {
    const btn = document.querySelector(
        `.select-food-btn[data-food-id="${foodId}"][data-day="${day}"]`
    );
    btn.classList.toggle('selected');
    btn.classList.toggle('btn-success');
    btn.classList.toggle('btn-primary');
    btn.textContent = btn.classList.contains('selected')
        ? 'Selected'
        : 'Select';

    if (btn.classList.contains('selected')) {
        reservationQueue.push({ date: day, foodId });
    } else {
        reservationQueue = reservationQueue.filter(
            (reservation) => reservation.foodId !== foodId
        );
    }
}

async function reserveFood(date, food) {
    const response = await fetchApi({
        url: "user/reserves",
        method: 'PUT',
        headers: {
            authorization: `Bearer ${NARIJE_TOKEN}`,
            'content-type': 'application/json',
        },
        body: [
            {
                datetime: date,
                reserves: [
                    {
                        foodId: food.foodId,
                        qty: 1,
                        foodType: 0,
                    },
                ],
            },
        ],
    });
    const responseData = await response.json();
    if (response.status === 200) {
        console.log(`Successfully reserved ${food.foodId} for ${date}.`);
        const reservationLogs = document.querySelector('.reservationLogs');
        reservationLogs.appendChild(
            document.createElement('p')
        ).textContent = `عذای ${food.foodId} با موفقیت برای تاریخ ${toJalali(
            date
        )} رزرو شد.`;

        const btn = document.querySelector(
            `.select-food-btn[data-food-id="${food.foodId}"][data-day="${date}"]`
        );
        btn.disabled = true;
        btn.textContent = 'Reserved';
    } else {
        console.error(
            `Failed to reserve food: ${responseData['message']}, date: ${date}`
        );
        const reservationLogs = document.querySelector('.reservationLogs');
        reservationLogs.appendChild(
            document.createElement('p')
        ).textContent = `خطا در رزرو غذا: ${
            responseData['message']
        }, در تاریخ: ${toJalali(date)}.`;

        const btn = document.querySelector(
            `.select-food-btn[data-food-id="${food.foodId}"][data-day="${date}"]`
        );
        btn.classList.toggle('selected');
        btn.classList.toggle('btn-success');
        btn.classList.toggle('btn-primary');
        btn.textContent = 'Select';
    }
}

async function getBearerToken(username, password) {
    const response = await fetchApi({
        url: "v1/Login",
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { mobile: username, password: password, panel: 'user' },
    });
    const responseData = await response.json();
    if (response.status === 200) {
        return responseData;
    } else {
        alert('Failed to get token: ' + responseData['message']);
        throw new Error('Failed to get token');
    }
}

function getFoods() {
    const date = new Date();

    const fromDate = date.toISOString();

    date.setMonth(date.getMonth() + 1);

    const toDate = date.toISOString();

    fetchApi(
        {
            url: `user/reserves?fromDate=${fromDate}&toDate=${toDate}`,
            headers: {
                accept: 'application/json, text/plain, */*',
                'accept-language': 'en-US,en;q=0.9',
                authorization: 'Bearer ' + NARIJE_TOKEN,
                dnt: '1',
                origin: 'https://my.narijeh.com',
                priority: 'u=1, i',
                referer: 'https://my.narijeh.com/',
                'sec-ch-ua':
                    '"Not)A;Brand";v="99", "Microsoft Edge";v="127", "Chromium";v="127"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Linux"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-site',
                'sec-gpc': '1',
                'user-agent':
                    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0',
            },
        }
    )
        .then((response) => response.json())
        .then((apiData) => {
            const foodContainer = document.getElementById('food-container');

            apiData.data.forEach((day) => {
                const dayDiv = document.createElement('div');
                dayDiv.className = 'col-lg-12 mb-4';
                dayDiv.innerHTML = `<h4 style="direction: rtl;">${toJalali(
                    day.datetime
                )}</h4>`;

                // add a row div
                const dayRowDiv = document.createElement('div');
                dayRowDiv.className = 'row';
                dayDiv.appendChild(dayRowDiv);

                day.reserves.forEach((food) => {
                    const foodDiv = document.createElement('div');
                    foodDiv.className = 'col-lg-4 mb-3';
                    foodDiv.innerHTML = `
                    <div class="card-body">
                        <h5 class="card-title">${food.food}</h5>
                        <img src="${
                            food.image || 'http://danihost.ir/da512.png'
                        }" class="img-fluid mb-2" alt="${
                        food.food
                    }" width="100%"> <br>
                        <button class="btn btn-primary select-food-btn" data-food-id="${
                            food.foodId
                        }" data-day="${
                        day.datetime
                    }" style="width: 100%" onclick="selectFood(${
                        food.foodId
                    }, '${day.datetime}')">Select</button>
                    </div>
                `;

                    if (food.qty === 1) {
                        const selectBtn =
                            foodDiv.querySelector('.select-food-btn');
                        selectBtn.disabled = true;
                        selectBtn.textContent = 'Reserved';
                    }
                    dayRowDiv.appendChild(foodDiv);
                });

                foodContainer.appendChild(dayDiv);
            });
        });
}

document
    .getElementById('login-form')
    .addEventListener('submit', function (event) {
        event.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        getBearerToken(username, password)
            .then((data) => {
                NARIJE_TOKEN = data.token;

                saveTokenToStorate(data.token, data.expire);

                toggleLogoutButton(true);
            })
            .then(() => {
                $('#loginModal').modal('hide');
                getFoods();
            });
    });

function processReservationQueue() {
    if (reservationQueue.length > 0) {
        const { date, foodId } = reservationQueue.shift();
        reserveFood(date, { foodId });
    }
}

setInterval(processReservationQueue, 11000);

document.addEventListener('DOMContentLoaded', function () {
    NARIJE_TOKEN = getTokenFromStorate();

    if (!NARIJE_TOKEN) {
        toggleLogoutButton(false);

        $('#loginModal').modal('show');

        return;
    }

    toggleLogoutButton(true);

    getFoods();
});
