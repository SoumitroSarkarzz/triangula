import {test,expect} from '@playwright/test';
test('desktop host and mobile guest play, refresh, resign and rematch',async({browser})=>{
 const hostContext=await browser.newContext({viewport:{width:1440,height:1000}}),guestContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const host=await hostContext.newPage(),guest=await guestContext.newPage();const errors:string[]=[];
 for(const page of [host,guest])page.on('pageerror',e=>errors.push(e.message));
 try{
 await host.goto('/');await expect(host.getByRole('heading',{name:'EVERY ANGLE IS AN OPPORTUNITY.'})).toBeVisible();
 await host.screenshot({path:'.playwright/home-desktop.png',fullPage:true});
 await host.getByLabel('YOUR ALIAS').fill('Night Owl');await host.getByRole('button',{name:'CREATE A ROOM'}).click();
 await expect(host.getByRole('heading',{name:'THE GREEN ROOM.'})).toBeVisible();const code=await host.locator('.room-code h2').innerText();
 await host.getByLabel('BOARD SIZE').selectOption('12');
 await guest.goto(`/?room=${code}`);await expect(guest.getByLabel('INVITE CODE')).toHaveValue(code);await guest.getByLabel('YOUR ALIAS').fill('Neon Fox');await guest.getByRole('button',{name:'JOIN',exact:true}).click();
 await expect(guest.getByRole('heading',{name:'THE GREEN ROOM.'})).toBeVisible();await guest.getByRole('button',{name:'I’M READY'}).click();await host.getByRole('button',{name:'START THE DUEL'}).click();
 await expect(host.locator('.board-panel')).toBeVisible();await expect(guest.locator('.board-panel')).toBeVisible();
 const active=(await host.getByRole('heading',{name:'YOUR MOVE!'}).count())?host:guest;
 await active.getByRole('button',{name:'Dot 1',exact:true}).focus();await active.keyboard.press('Enter');await active.getByRole('button',{name:'Dot 2',exact:true}).focus();await active.keyboard.press('Enter');
 await expect(host.locator('.board-top')).toContainText('1 EDGES');await expect(guest.locator('.board-top')).toContainText('1 EDGES');
 await guest.reload();await expect(guest.locator('.board-top')).toContainText('1 EDGES');await expect(host.locator('.pause-banner')).toHaveCount(0);
 const next=(await host.getByRole('heading',{name:'YOUR MOVE!'}).count())?host:guest;
 await next.getByRole('button',{name:'Dot 3',exact:true}).click();await next.getByRole('button',{name:'Dot 4',exact:true}).click();await expect(host.locator('.board-top')).toContainText('2 EDGES');
 await guest.screenshot({path:'.playwright/match-mobile.png',fullPage:true});await host.screenshot({path:'.playwright/match-desktop.png',fullPage:true});
 expect(await guest.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await host.getByRole('button',{name:'RESIGN MATCH'}).click();await host.getByRole('button',{name:'YES, RESIGN'}).click();await expect(guest.getByRole('heading',{name:'VICTORY!'})).toBeVisible();
 await host.getByRole('button',{name:'REMATCH',exact:true}).click();await guest.getByRole('button',{name:'REMATCH',exact:true}).click();await expect(host.locator('.board-top')).toContainText('0 EDGES');
 await guest.getByRole('button',{name:'How to play'}).click();await expect(guest.getByRole('dialog')).toBeVisible();await guest.keyboard.press('Escape');await expect(guest.getByRole('dialog')).toHaveCount(0);
 expect(errors).toEqual([]);
 }finally{await hostContext.close();await guestContext.close();}
});
