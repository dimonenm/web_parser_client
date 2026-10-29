import { Injectable } from '@nestjs/common';
import puppeteer, { Browser, Page } from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';
import {
  deley,
  formatDuration,
  makeHTMLFile,
  makeScreenshot,
  saveJsonFile,
  setAuthCookies,
} from './instagram.utils';
import { IGalleryItem, IPost, IStatusData } from './instagram.interfaces';

@Injectable()
export class InstagramService {
  private deleyCount = 500;

  // поля класса
  // Состояние обработки галереи — отдаётся клиенту через getPostsStatus
  private status: IStatusData = this.createIdleStatus();

  // Определяем корневую папку для скачивания
  mainDir = path.join(process.cwd(), 'uploads');

  /**
   * Актуальное состояние обработки постов для клиентской части.
   * Возвращаем копию, чтобы нельзя было изменить внутреннее состояние.
   */
  getPostsStatus(): IStatusData {
    const { startedAt, finishedAt } = this.status;
    const status: IStatusData = {
      ...this.status,
      elapsedMs: startedAt ? (finishedAt ?? Date.now()) - startedAt : 0,
    };

    console.log('Posts Status was send', {
      id: status.id,
      current: status.current,
      total: status.total,
      running: status.running,
    });

    return status;
  }

  private createIdleStatus(): IStatusData {
    return {
      id: '',
      running: false,
      current: 0,
      total: 0,
      scanned: 0,
      round: 0,
      lastShortCode: null,
      startedAt: null,
      finishedAt: null,
      elapsedMs: 0,
      error: null,
    };
  }

  private patchStatus(patch: Partial<IStatusData>): void {
    this.status = { ...this.status, ...patch };
  }

  // async getAllPostsFromGallary(id: string): Promise<string> {
  //   // Опредение адреса для запроса
  //   const url = `https://www.instagram.com/${id}/`;

  //   // Общий таймер обработки галереи
  //   const galleryStart = Date.now();

  //   // Инициализация и настройка браузера
  //   const browser = await puppeteer.launch({
  //     headless: true,
  //   });
  //   await setAuthCookies(browser);

  //   // Настройка страницы
  //   const page = await browser.newPage();
  //   await page.setViewport({ width: 1920, height: 1080 });

  //   // Переход на сстраницу профиля
  //   try {
  //     await page.goto(url, { waitUntil: 'domcontentloaded' });
  //     await deley(this.deleyCount);
  //   } catch (e) {
  //     console.log('Ошибка загрузки страницы:', (e as Error).message);
  //   }

  //   // Ожидание загрузки селектора для выбора элемента количества постов
  //   try {
  //     await page.waitForSelector('div:nth-child(1) > span > span > span', {
  //       timeout: 10000,
  //     });
  //   } catch (e) {
  //     console.warn('Селектор поста не найден.');
  //   }

  //   // Определение количества постов на странице
  //   const postCount: number = await page.evaluate((): number => {
  //     const elem: HTMLSpanElement | null = document.querySelector(
  //       'div:nth-child(1) > span > span > span',
  //     );
  //     if (elem) {
  //       return Number(elem.innerText);
  //     } else {
  //       return 0;
  //     }
  //   });

  //   console.log('postCount: ', postCount);

  //   // --- Множества для отслеживания обработанных постов ---
  //   const processedShortCodes = new Set<string>();
  //   const posts: IPost[] = [];

  //   // --- Основной цикл: сбор → обработка → прокрутка → повтор ---
  //   let stableRounds = 0;
  //   const maxScrolls = Math.ceil(postCount / 12) + 20;

  //   for (let s = 0; s < maxScrolls; s++) {
  //     console.log(`--- Раунд прокрутки ${s + 1} ---`);

  //     // 1. Сбор видимых постов
  //     const gelleryItems: IGalleryItem[] = await page.evaluate(() => {
  //       const items: IGalleryItem[] = [];
  //       const seen = new Set<string>();

  //       const elems: NodeListOf<HTMLAnchorElement> =
  //         document.querySelectorAll('div.xg7h5cd a');

  //       elems.forEach((a: HTMLAnchorElement, index: number) => {
  //         const href = a.getAttribute('href');
  //         if (!href) return;

  //         const match = href.match(/\/(p|reel|reels|tv)\/([^/?#]+)/);
  //         if (!match) return;

  //         const shortCode: string = match[2];
  //         if (seen.has(shortCode)) return;
  //         seen.add(shortCode);

  //         // Превью: все отрисованные картинки внутри якоря сетки
  //         const previewImgs = Array.from(
  //           a.querySelectorAll<HTMLImageElement>('div._aagu img'),
  //         );
  //         const picUrls: string[] = previewImgs
  //           .map((img) => img.currentSrc || img.src)
  //           .filter((src) => Boolean(src));

  //         items.push({
  //           type: match[1] === 'p' ? 'p' : 'reel',
  //           shortCode,
  //           index,
  //           picUrls,
  //         });
  //       });

  //       return items;
  //     });

  //     // 2. Обработка постов
  //     let processedThisRound = 0;

  //     for (const item of gelleryItems) {
  //       if (processedShortCodes.has(item.shortCode)) continue;

  //       const postStart = Date.now();

  //       // Reel: превью уже в сетке (item.picUrls), модалку не открываем
  //       if (item.type !== 'p') {
  //         if (item.picUrls.length === 0) {
  //           // картинка ещё не отрисовалась (ленивая загрузка) — догоним в следующем раунде
  //           continue;
  //         }
  //         processedShortCodes.add(item.shortCode);
  //         processedThisRound++;
  //         posts.push({
  //           type: item.type,
  //           shortCode: item.shortCode,
  //           picUrls: item.picUrls,
  //         });
  //         console.log(
  //           `Рил ${item.shortCode}: превью получено (${item.picUrls.length} шт.), время: ${formatDuration(Date.now() - postStart)}`,
  //         );
  //         continue;
  //       }

  //       // Пост с изображениями: открываем модалку (дальше — без изменений)
  //       processedShortCodes.add(item.shortCode);
  //       processedThisRound++;

  //       // Клик по якорю поста в сетке
  //       await page.evaluate((i: number) => {
  //         const a =
  //           document.querySelectorAll<HTMLAnchorElement>('div.xg7h5cd a')[i];
  //         a?.click();
  //       }, item.index);

  //       await deley(this.deleyCount);

  //       // Ожидаем модальное окно
  //       try {
  //         await page.waitForSelector('div[role="dialog"]', { timeout: 8000 });
  //       } catch {
  //         console.warn(
  //           `Модальное окно не открылось для ${item.shortCode}, время: ${formatDuration(Date.now() - postStart)}`,
  //         );
  //         // Пытаемся закрыть и продолжить
  //         try {
  //           await page.keyboard.press('Escape');
  //           await deley(this.deleyCount);
  //         } catch {}
  //         continue;
  //       }

  //       // Количество слайдов
  //       const imgCount: number = await page.evaluate(
  //         () => document.querySelectorAll('div._acnb').length,
  //       );

  //       console.log(`Пост ${item.shortCode}: слайдов = ${imgCount}`);

  //       // Сбор URL изображений
  //       const picsurl: string[] = [];
  //       const seenSrc = new Set<string>();

  //       const collectSrc = async (): Promise<void> => {
  //         const srcs: string[] = await page.evaluate(() => {
  //           // Карусель: слайды лежат внутри <ul>
  //           const carouselImgs = document.querySelectorAll<HTMLImageElement>(
  //             'ul img.x5yr21d.xu96u03.x10l6tqk.x13vifvy.x87ps6o.xh8yej3',
  //           );
  //           if (carouselImgs.length > 0) {
  //             return Array.from(carouselImgs).map(
  //               (el) => el.currentSrc || el.src,
  //             );
  //           }
  //           // Одиночное изображение: <ul> не рендерится, ищем картинку прямо в модалке
  //           const singleImgs = document.querySelectorAll<HTMLImageElement>(
  //             'div[role="dialog"] img.xu96u03',
  //           );
  //           return Array.from(singleImgs).map((el) => el.currentSrc || el.src);
  //         });
  //         for (const src of srcs) {
  //           if (src && !seenSrc.has(src)) {
  //             seenSrc.add(src);
  //             picsurl.push(src);
  //           }
  //         }
  //       };

  //       await collectSrc();

  //       // Листание по стрелке вперёд
  //       for (let slide = 1; slide < imgCount; slide++) {
  //         await page.evaluate(() => {
  //           const arrow = document.querySelector<HTMLButtonElement>(
  //             'button._afxw._al46._al47',
  //           );
  //           arrow?.click();
  //         });
  //         await deley(this.deleyCount);
  //         await collectSrc();
  //       }

  //       console.log(
  //         `  picsurl собрано: ${picsurl.length}, время поста: ${formatDuration(Date.now() - postStart)}`,
  //       );
  //       posts.push({
  //         type: item.type,
  //         shortCode: item.shortCode,
  //         picUrls: picsurl,
  //       });

  //       // Закрытие модалки
  //       await page.keyboard.press('Escape');
  //       await deley(this.deleyCount);
  //     }

  //     console.log(`Обработано всего постов: ${posts.length}`);

  //     // 3. Раунд не дал ни одного нового поста — лента на исходе
  //     if (processedThisRound === 0) {
  //       stableRounds++;
  //       if (stableRounds >= 3) {
  //         console.log('Лента больше не грузится, выходим из цикла');
  //         break;
  //       }
  //     } else {
  //       stableRounds = 0;
  //     }

  //     // 4. Прокрутка вниз для загрузки новых постов
  //     await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  //     await deley(this.deleyCount);
  //   }

  //   console.log('Итого постов с картинками:', posts.length);
  //   console.log(
  //     `Общее время обработки галереи: ${formatDuration(Date.now() - galleryStart)}`,
  //   );

  //   // await makeScreenshot(page, 'getAllPostsFromGallary_done');
  //   await browser.close();

  //   if (posts.length) {
  //     saveJsonFile(this.mainDir, `${id}_Gallery`, posts);
  //   }

  //   return JSON.stringify(posts);
  // }

    async getAllPostsFromGallary(id: string): Promise<string> {
    // Опредение адреса для запроса
    const url = `https://www.instagram.com/${id}/`;

    // Общий таймер обработки галереи
    const galleryStart = Date.now();

    // Стартуем обработку: клиент с этого момента видит running: true
    this.status = {
      ...this.createIdleStatus(),
      id,
      running: true,
      startedAt: galleryStart,
    };

    let browser: Browser | null = null;

    try {
      // Инициализация и настройка браузера
      browser = await puppeteer.launch({
        headless: true,
      });
      await setAuthCookies(browser);

      // Настройка страницы
      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });

      // Переход на сстраницу профиля
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await deley(this.deleyCount);
      } catch (e) {
        console.log('Ошибка загрузки страницы:', (e as Error).message);
      }

      // Ожидание загрузки селектора для выбора элемента количества постов
      try {
        await page.waitForSelector('div:nth-child(1) > span > span > span', {
          timeout: 10000,
        });
      } catch (e) {
        console.warn('Селектор поста не найден.');
      }

      // Определение количества постов на странице
      const postCount: number = await page.evaluate((): number => {
        const elem: HTMLSpanElement | null = document.querySelector(
          'div:nth-child(1) > span > span > span',
        );
        if (elem) {
          return Number(elem.innerText);
        } else {
          return 0;
        }
      });

      console.log('postCount: ', postCount);
      this.patchStatus({ total: postCount });

      // --- Множества для отслеживания обработанных постов ---
      const processedShortCodes = new Set<string>();
      const posts: IPost[] = [];

      // --- Основной цикл: сбор → обработка → прокрутка → повтор ---
      let stableRounds = 0;
      const maxScrolls = Math.ceil(postCount / 12) + 20;

      for (let s = 0; s < maxScrolls; s++) {
        console.log(`--- Раунд прокрутки ${s + 1} ---`);
        this.patchStatus({ round: s + 1 });

        // 1. Сбор видимых постов
        const gelleryItems: IGalleryItem[] = await page.evaluate(() => {
          const items: IGalleryItem[] = [];
          const seen = new Set<string>();

          const elems: NodeListOf<HTMLAnchorElement> =
            document.querySelectorAll('div.xg7h5cd a');

          elems.forEach((a: HTMLAnchorElement, index: number) => {
            const href = a.getAttribute('href');
            if (!href) return;

            const match = href.match(/\/(p|reel|reels|tv)\/([^/?#]+)/);
            if (!match) return;

            const shortCode: string = match[2];
            if (seen.has(shortCode)) return;
            seen.add(shortCode);

            // Превью: все отрисованные картинки внутри якоря сетки
            const previewImgs = Array.from(
              a.querySelectorAll<HTMLImageElement>('div._aagu img'),
            );
            const picUrls: string[] = previewImgs
              .map((img) => img.currentSrc || img.src)
              .filter((src) => Boolean(src));

            items.push({
              type: match[1] === 'p' ? 'p' : 'reel',
              shortCode,
              index,
              picUrls,
            });
          });

          return items;
        });

        // 2. Обработка постов
        let processedThisRound = 0;

        for (const item of gelleryItems) {
          if (processedShortCodes.has(item.shortCode)) continue;

          const postStart = Date.now();

          // Reel: превью уже в сетке (item.picUrls), модалку не открываем
          if (item.type !== 'p') {
            if (item.picUrls.length === 0) {
              // картинка ещё не отрисовалась (ленивая загрузка) — догоним в следующем раунде
              continue;
            }
            processedShortCodes.add(item.shortCode);
            processedThisRound++;
            posts.push({
              type: item.type,
              shortCode: item.shortCode,
              picUrls: item.picUrls,
            });
            this.patchStatus({
              current: posts.length,
              scanned: processedShortCodes.size,
              lastShortCode: item.shortCode,
            });
            console.log(
              `Рил ${item.shortCode}: превью получено (${item.picUrls.length} шт.), время: ${formatDuration(Date.now() - postStart)}`,
            );
            continue;
          }

          // Пост с изображениями: открываем модалку (дальше — без изменений)
          processedShortCodes.add(item.shortCode);
          processedThisRound++;

          // Клик по якорю поста в сетке
          await page.evaluate((i: number) => {
            const a =
              document.querySelectorAll<HTMLAnchorElement>('div.xg7h5cd a')[i];
            a?.click();
          }, item.index);

          await deley(this.deleyCount);

          // Ожидаем модальное окно
          try {
            await page.waitForSelector('div[role="dialog"]', { timeout: 8000 });
          } catch {
            console.warn(
              `Модальное окно не открылось для ${item.shortCode}, время: ${formatDuration(Date.now() - postStart)}`,
            );
            // Пытаемся закрыть и продолжить
            try {
              await page.keyboard.press('Escape');
              await deley(this.deleyCount);
            } catch {}
            continue;
          }

          // Количество слайдов
          const imgCount: number = await page.evaluate(
            () => document.querySelectorAll('div._acnb').length,
          );

          console.log(`Пост ${item.shortCode}: слайдов = ${imgCount}`);

          // Сбор URL изображений
          const picsurl: string[] = [];
          const seenSrc = new Set<string>();

          const collectSrc = async (): Promise<void> => {
            const srcs: string[] = await page.evaluate(() => {
              // Карусель: слайды лежат внутри <ul>
              const carouselImgs = document.querySelectorAll<HTMLImageElement>(
                'ul img.x5yr21d.xu96u03.x10l6tqk.x13vifvy.x87ps6o.xh8yej3',
              );
              if (carouselImgs.length > 0) {
                return Array.from(carouselImgs).map(
                  (el) => el.currentSrc || el.src,
                );
              }
              // Одиночное изображение: <ul> не рендерится, ищем картинку прямо в модалке
              const singleImgs = document.querySelectorAll<HTMLImageElement>(
                'div[role="dialog"] img.xu96u03',
              );
              return Array.from(singleImgs).map((el) => el.currentSrc || el.src);
            });
            for (const src of srcs) {
              if (src && !seenSrc.has(src)) {
                seenSrc.add(src);
                picsurl.push(src);
              }
            }
          };

          await collectSrc();

          // Листание по стрелке вперёд
          for (let slide = 1; slide < imgCount; slide++) {
            await page.evaluate(() => {
              const arrow = document.querySelector<HTMLButtonElement>(
                'button._afxw._al46._al47',
              );
              arrow?.click();
            });
            await deley(this.deleyCount);
            await collectSrc();
          }

          console.log(
            `  picsurl собрано: ${picsurl.length}, время поста: ${formatDuration(Date.now() - postStart)}`,
          );
          posts.push({
            type: item.type,
            shortCode: item.shortCode,
            picUrls: picsurl,
          });
          this.patchStatus({
            current: posts.length,
            scanned: processedShortCodes.size,
            lastShortCode: item.shortCode,
          });

          // Закрытие модалки
          await page.keyboard.press('Escape');
          await deley(this.deleyCount);
        }

        console.log(`Обработано всего постов: ${posts.length}`);

        // 3. Раунд не дал ни одного нового поста — лента на исходе
        if (processedThisRound === 0) {
          stableRounds++;
          if (stableRounds >= 3) {
            console.log('Лента больше не грузится, выходим из цикла');
            break;
          }
        } else {
          stableRounds = 0;
        }

        // 4. Прокрутка вниз для загрузки новых постов
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await deley(this.deleyCount);
      }

      console.log('Итого постов с картинками:', posts.length);
      console.log(
        `Общее время обработки галереи: ${formatDuration(Date.now() - galleryStart)}`,
      );

      // await makeScreenshot(page, 'getAllPostsFromGallary_done');

      if (posts.length) {
        saveJsonFile(this.mainDir, `${id}_Gallery`, posts);
      }

      return JSON.stringify(posts);
    } catch (e) {
      this.patchStatus({ error: (e as Error).message });
      throw e;
    } finally {
      // close() был в теле метода — переносим сюда, чтобы браузер не оставлялся
      // висеть при исключении, а running гарантированно сбрасывался
      await browser?.close().catch(() => {});
      this.patchStatus({ running: false, finishedAt: Date.now() });
    }
  }

}
