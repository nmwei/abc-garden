export const GUIDED_GAMES=Object.freeze({
 mirror:{title:'镜子小游戏',instruction:'家长做一个轻松的表情，孩子照着做；再换孩子做，家长来模仿。先不重复刚才的英文。'},
 drawing:{title:'手指画画',instruction:'用手指在空中画个圈或一条线，让对方猜猜画了什么，再交换角色。先不重复刚才的英文。'},
 rhythm:{title:'拍手小节奏',instruction:'家长拍一个简单节奏，让孩子照着拍；再让孩子出一个节奏。先不重复刚才的英文。'},
});
export const guidedGameIds=Object.freeze(Object.keys(GUIDED_GAMES));
export const guidedGame=id=>GUIDED_GAMES[id];
