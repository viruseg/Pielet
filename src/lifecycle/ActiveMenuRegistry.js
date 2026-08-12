/**
 * Module-level реестр активного меню.
 * Гарантирует, что на странице одновременно открыто только одно меню:
 * при открытии нового экземпляра реестр возвращает предыдущий активный,
 * который должен быть закрыт до развёртывания нового runtime.
 * Закрытые экземпляры не имеют глобальных listeners и не регистрируются.
 */

/** @type {object | null} */
let activeMenu = null;

/**
 * Регистрирует меню как активное.
 * @param {object} menu - экземпляр Pielet
 * @returns {object | null} предыдущее активное меню (если было иное)
 */
export function acquireActiveMenu(menu) {
    const previous = activeMenu && activeMenu !== menu ? activeMenu : null;
    activeMenu = menu;
    return previous;
}

/**
 * Снимает регистрацию меню, если оно является активным.
 * @param {object} menu
 */
export function releaseActiveMenu(menu) {
    if (activeMenu === menu) {
        activeMenu = null;
    }
}

/**
 * @returns {object | null} текущее активное меню
 */
export function getActiveMenu() {
    return activeMenu;
}