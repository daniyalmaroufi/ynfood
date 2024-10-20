const RESERVATION_QUEUE = {
    queue: [],
    isEmpty() {
        return !this.queue.length;
    },
    add(food, date, isCancel) {
        this.queue.push({ food, date, isCancel });
    },
    get() {
        return this.queue.shift();
    },
    remove(foodId, date) {
        this.queue = this.queue.filter((reservation) => {
            return (
                reservation.food.foodId !== foodId || reservation.date !== date
            );
        });
    },
};

let NARIJE_TOKEN = undefined;

const BASE_API_URL = 'https://api.narijeh.com';

let START_DAY = moment();

const BUTTON_STATES = {
    SELECTED: 'SELECTED',
    RESERVED: 'RESERVED',
    CANCEL: 'CANCEL',
};

const LOGS_CONTAINER = $('#toast-container');

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

function showLoginModal() {
    $('#login-modal').modal('show');
}

function handleLogout() {
    localStorage.clear();

    window.location.reload();
}

function toggleAccountButton(isLoggedIn) {
    const accountButtonContainer = $('#account-button-container');

    const button = $('<button />', {
        type: 'button',
        text: isLoggedIn ? 'خروج از حساب' : 'ورود به حساب',
        class: isLoggedIn ? 'btn-danger' : 'btn-primary',
        click: isLoggedIn ? handleLogout : showLoginModal,
    });

    button.addClass('btn');

    accountButtonContainer.html(button);
}

// TODO: Handle 401 or 403 error
async function fetchApi({ url, method = 'GET', headers, body }) {
    return fetch(`${BASE_API_URL}/${url}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });
}

function toJalali(date, format = 'ddd DD MMMM') {
    return moment(date).locale('fa').format(format);
}

function setCurrentMonthName() {
    $('#current-month').html(
        START_DAY.clone().locale('fa').format('MMMM YYYY'),
    );
}

function isInSameMonth(firstMoment, secondMoment) {
    return (
        firstMoment.jYear() === secondMoment.jYear() &&
        firstMoment.jMonth() === secondMoment.jMonth()
    );
}

function changeMonth(step) {
    if (!RESERVATION_QUEUE.isEmpty()) return;

    const now = moment();

    if (step < 0 && isInSameMonth(now, START_DAY)) {
        return;
    }

    START_DAY.add(step, 'jMonth').startOf('jMonth');

    if (isInSameMonth(now, START_DAY)) {
        START_DAY = now;
    }

    setCurrentMonthName();

    getFoods();
}

function getFoodButton({ foodId, date, state }) {
    let selector = `button`;

    if (foodId) {
        selector += `[data-food-id='${foodId}']`;
    }

    if (date) {
        selector += `[data-date='${date}']`;
    }

    if (state) {
        selector += `[data-state="${state}"]`;
    }

    return $(selector);
}

function changeButtonState(button, state) {
    button.attr('data-state', state ?? '');

    switch (state) {
        case BUTTON_STATES.SELECTED:
            button.addClass('btn-info');

            button.removeClass('btn-primary btn-success btn-danger');

            button.html(`
                در صف رزرو
                <div class="spinner-border spinner-border-sm" role="status"></div>
            `);

            return;

        case BUTTON_STATES.RESERVED:
            button.addClass('btn-success');

            button.removeClass('btn-primary btn-info btn-danger');

            button.html('رزرو شده');

            return;

        case BUTTON_STATES.CANCEL:
            button.addClass('btn-danger');

            button.removeClass('btn-primary btn-success btn-info');

            button.html(`
                در انتظار لغو
                <div class="spinner-border spinner-border-sm" role="status"></div>
            `);

            return;
    }

    button.addClass('btn-primary');

    button.removeClass('btn-success btn-info btn-danger');

    button.html('انتخاب');
}

function handleFoodButtonClick(food, date) {
    const foodId = food.foodId;

    const clickedButton = getFoodButton({ date, foodId });

    const state = clickedButton.attr('data-state');

    switch (state) {
        case BUTTON_STATES.SELECTED:
            changeButtonState(clickedButton);

            RESERVATION_QUEUE.remove(foodId, date);

            return;

        case BUTTON_STATES.RESERVED:
            changeButtonState(clickedButton, BUTTON_STATES.CANCEL);

            RESERVATION_QUEUE.add(food, date, true);

            return;

        case BUTTON_STATES.CANCEL:
            changeButtonState(clickedButton, BUTTON_STATES.RESERVED);

            RESERVATION_QUEUE.remove(foodId, date);

            return;
    }

    const sameDayReservedButton = getFoodButton({
        date,
        state: BUTTON_STATES.RESERVED,
    });

    if (sameDayReservedButton.length) {
        showAlertModal(`
            شما یک غذای رزرو شده در این روز دارید
            <br />
            برای تغییر غذا باید ابتدا غذای رزرو شده در این روز را لغو نمایید    
        `);
        return;
    }

    const sameDaySelectedButton = getFoodButton({
        date,
        state: BUTTON_STATES.SELECTED,
    });

    if (sameDaySelectedButton.length) {
        changeButtonState(sameDaySelectedButton);

        RESERVATION_QUEUE.remove(
            Number(sameDaySelectedButton.attr('data-food-id')),
            date,
        );
    }

    changeButtonState(clickedButton, BUTTON_STATES.SELECTED);

    RESERVATION_QUEUE.add(food, date);
}

function addReserveLog({ type, foodName, date, text }) {
    const isSuccess = type === 'success';

    const log = $('<div>', {
        class: 'alert alert-dismissible text-right fade show',
        html: `
            <div class="alert-heading">
                <button type="button" class="close ml-2" data-dismiss="alert" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>

                <strong>${toJalali(date)}</strong>
            </div>

            <small>${foodName}</small>

            <hr class="mt-1 mb-1" />

            <div>${text}</div>
        `,
    });

    log.addClass(isSuccess ? 'alert-success' : 'alert-danger');

    LOGS_CONTAINER.prepend(log);

    isSuccess && setTimeout(() => log.alert('close'), 5000);
}

function showAlertModal(content) {
    const alertModal = $('#alert-modal');

    alertModal.find('.modal-body').html(content);

    alertModal.modal('show');
}

async function orderFood({ food, date, isCancel }) {
    const foodId = food.foodId;

    const foodName = food.food;

    const response = await fetchApi({
        url: 'user/reserves',
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
                        foodId,
                        qty: isCancel ? 0 : 1,
                        foodType: 0,
                    },
                ],
            },
        ],
    });

    const responseData = await response.json();

    const button = getFoodButton({ foodId, date });

    if (response.status === 200) {
        console.log(
            date,
            isCancel ? 'Successfully un-reserved' : 'Successfully reserved',
            foodName,
        );

        addReserveLog({
            date,
            foodName,
            type: 'success',
            text: isCancel ? 'با موفقیت لغو شد' : 'با موفقیت رزرو شد',
        });

        changeButtonState(
            button,
            isCancel ? undefined : BUTTON_STATES.RESERVED,
        );
    } else {
        console.error(
            date,
            isCancel ? 'Failed to un-reserve' : 'Faild to reserve',
            responseData['message'],
            foodName,
        );

        addReserveLog({
            date,
            foodName,
            type: 'error',
            text: responseData['message'],
        });

        changeButtonState(
            button,
            isCancel ? BUTTON_STATES.RESERVED : undefined,
        );
    }
}

async function getBearerToken(username, password) {
    const response = await fetchApi({
        url: 'v1/Login',
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { mobile: username, password, panel: 'user' },
    });

    const responseData = await response.json();

    if (response.status === 200) {
        return responseData;
    } else {
        alert('Failed to get token: ' + responseData['message']);
        throw new Error('Failed to get token');
    }
}

function createFoodCard(food, date) {
    const foodCard = $('<div>', {
        class: 'card col-lg-3 p-1',
        html: `
            <img loading="lazy" class="card-img-top rounded" src="${
                food.image || 'http://danihost.ir/da512.png'
            }" alt="${food.food}" width="100%" height="200">
                        
            <div class="card-body d-flex flex-column justify-content-between">
                <h5 class="card-title text-right">${food.food}</h5>
            </div>
        `,
    });

    const isReserved = food.qty === 1;

    const selectButton = $('<button>', {
        class: 'btn d-block w-100',
        text: isReserved ? 'رزرو شده' : 'انتخاب',
        click: () => handleFoodButtonClick(food, date),
        'data-food-id': food.foodId,
        'data-date': date,
    });

    selectButton.addClass(isReserved ? 'btn-success' : 'btn-primary');

    if (isReserved) {
        selectButton.attr('data-state', BUTTON_STATES.RESERVED);
    }

    foodCard.find('.card-body').append(selectButton);

    return foodCard;
}

function getFoods() {
    LOGS_CONTAINER.empty();

    const foodContainer = $('#food-container');

    foodContainer.empty();

    const fromDate = START_DAY.format('YYYY-MM-DD');

    const toDate = START_DAY.clone().endOf('jMonth').format('YYYY-MM-DD');

    fetchApi({
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
    })
        .then((response) => response.json())
        .then((apiData) => {
            apiData.data.forEach((day) => {
                const dayContainer = $('<div>');

                const hasFood = !!day.reserves?.length;

                const dayHeader = $('<h4>', {
                    class: `mb-4 text-right ${!hasFood ? 'text-danger' : ''}`,
                    text: toJalali(day.datetime),
                });

                dayContainer.append(dayHeader);

                if (hasFood) {
                    const dayFoodsRow = $('<div>', {
                        class: 'row justify-content-center flex-nowrap p-2',
                        style: 'gap: 0.5rem',
                    });

                    day.reserves.forEach((food) => {
                        dayFoodsRow.append(createFoodCard(food, day.datetime));
                    });

                    dayContainer.append(dayFoodsRow);
                }

                foodContainer.append(
                    dayContainer,
                    $('<hr>', { class: 'my-3' }),
                );
            });
        });
}

$('#login-form').on('submit', function (event) {
    event.preventDefault();

    const formData = new FormData(event.target);

    getBearerToken(formData.get('username'), formData.get('password')).then(
        (data) => {
            NARIJE_TOKEN = data.token;

            saveTokenToStorate(data.token, data.expire);

            toggleAccountButton(true);

            $('#login-modal').modal('hide');

            getFoods();
        },
    );
});

function processReservationQueue() {
    if (RESERVATION_QUEUE.isEmpty()) return;

    orderFood(RESERVATION_QUEUE.get());
}

setInterval(processReservationQueue, 6000);

setCurrentMonthName();

document.addEventListener('DOMContentLoaded', function () {
    NARIJE_TOKEN = getTokenFromStorate();

    if (!NARIJE_TOKEN) {
        toggleAccountButton(false);

        showLoginModal();

        return;
    }

    toggleAccountButton(true);

    getFoods();
});
