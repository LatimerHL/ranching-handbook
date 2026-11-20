export const repository = 'https://github.com/LatimerHL/RanchingFieldNotes';
export const projectRepository = 'https://github.com/LatimerHL/ranching-handbook';
export const defaultLocale = 'zh-Hans';

export const localArticle = path => 'read/' + path.replace(/\.md$/, '.html');
export const sitePath = (base, path = '') => base.replace(/\/?$/, '/') + path;

export const fanContentNotice = `<p>牧场笔记是独立的非官方粉丝作品。游戏权利归 Monomi Park, LLC 所有。</p>
<p lang="en">“牧场笔记” is unofficial Fan Content permitted under the <a href="https://www.slimerancher.com/fan-content-policy/">Fan Content Policy</a>. Not approved/endorsed by Monomi Park. Portions of the materials used are property of Monomi Park, LLC. ©Monomi Park LLC.</p>`;
