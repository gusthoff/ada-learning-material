/**
 * Enables the scroll-to-top functionality
 *
 * @export
 * @param {HTMLButtonElement} btn
 */
export function scrollTop(btn: HTMLButtonElement): void {
  btn.classList.add('hide');

  window.addEventListener('scroll', () => {
    /* istanbul ignore next */
    if (document.body.scrollTop > 300) {
      btn.classList.remove('hide');
      btn.classList.add('show');
    } else {
      btn.classList.remove('show');
      btn.classList.add('hide');
    }
  });

  btn.addEventListener('click', () => {
    window.scrollTo(0, 0);
  });
}
