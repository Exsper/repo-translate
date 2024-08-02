const {buildTemplate, createTemplate, emptyDistFolder, translateRepo} = require("./BuildTemplate");

async function testTemplate() {
    let a = await buildTemplate("./source-repo/test", ["exclude", "exclude.js"], [{filePath: "./source-repo/test/index.js", skipText: `"./lib/add"`}]);

    console.log(a)
}

async function testCreateTemplate() {
    await createTemplate("./source-repo/test", "./translates/translate.json", ["exclude", "exclude.js"], [{filePath: "./source-repo/test/index.js", skipText: `"./lib/add"`}]);
}

async function testChangeTemplate() {
    // 需要将source-repo中的文件夹test和test2交换名称
    await createTemplate("./source-repo/test", "./translates/translate.json", ["exclude", "exclude.js"], [{filePath: "./source-repo/test/index.js", skipText: `"./lib/add"`}]);
}

async function testEmptyDist() {
    await emptyDistFolder("./dist-repo");
}

async function testTranslate() {
    await createTemplate("./source-repo/test3", "./translates/translate.json", [".exclude"], [{filePath: "./source-repo/test3/index.js", skipText: `"./lib/add"`}]);

    // 此处修改translate.json
    console.log("1");

    await translateRepo("./source-repo/test3",  "./translates/translate.json", "./dist-repo", [".exclude"] );
}

testTranslate();