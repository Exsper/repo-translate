const fs = require("fs").promises;
const path = require("path");

function getContentBetweenQuotes(str) {
    const quoteRegex = /"([^"]*)"|'([^']*)'|`([^`]*)`/g;
    const match = str.match(quoteRegex);
    return match;
}

async function readFile(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return data;
    } catch (err) {
        console.error("无法读取文件：" + filePath + "\n", err);
        return null;
    }
}

/**
 * @param {string} filepath 
 * @param {Array<string>} skipPaths 
 * @returns 
 */
function isPathInSkip(filepath, skipPaths) {
    return skipPaths.some((skipPath) => filepath.endsWith(skipPath));
}

async function buildFileList(folder, skipPaths = []) {
    let filePaths = [];
    try {
        const files = await fs.readdir(folder);
        for (let i = 0; i < files.length; i++) {
            let filePath = "./" + path.join(folder, files[i]);
            let stats = await fs.stat(filePath);
            if (stats.isDirectory()) {
                if (isPathInSkip(filePath, skipPaths)) continue;
                else filePaths.push(...await buildFileList(filePath, skipPaths));
            }
            else {
                if (isPathInSkip(filePath, skipPaths)) continue;
                else filePaths.push(filePath);
            }
        }
        return filePaths;
    }
    catch (err) {
        console.error("无法读取文件夹：" + folder + "\n", err);
        return [];
    }
}

/**
 * @param {string} orgfolder 
 * @param {Array<string>} skipPaths 忽略翻译的文件（夹）路径
 * @param {Array<{filePath:string, skipText:string}>} skipTexts [{filePath: 忽略文本所在文件，不提供则默认所有文件, skipText: 忽略文本，filePath中出现该文本则不加入翻译Json}, ...]
 */
async function buildTemplate(orgfolder, skipPaths = [], skipTexts = []) {
    let filePaths = await buildFileList(orgfolder, skipPaths);
    let template = {};

    for (let i = 0; i < filePaths.length; i++) {
        try {
            let data = await readFile(filePaths[i]);
            let strings = getContentBetweenQuotes(data);
            if (!strings) {
                console.log(filePaths[i] + " 不含字符串");
                continue;
            }
            else {
                let skipTextsInThisFile = [];
                skipTexts.map((skipText) => {
                    if (!skipText.filePath) skipTextsInThisFile.push(skipText.skipText);
                    else {
                        let skipFilePath = "./" + path.join(skipText.filePath);
                        if (skipFilePath === filePaths[i]) {
                            skipTextsInThisFile.push(skipText.skipText);
                        }
                    }
                })

                let fileStrings = {};
                strings.map((string) => {
                    if (!skipTextsInThisFile.includes(string)) fileStrings[string] = string;
                });
                template[filePaths[i]] = fileStrings;
            }
        }
        catch (err) {
            console.error("无法读取文件：" + filePaths[i] + "\n", err);
            continue;
        }
    }
    return template;
}

/**
 * @param {string} orgfolder 
 * @param {string} outputPath 
 * @param {Array<string>} skipPaths 忽略翻译的文件（夹）路径
 * @param {Array<{filePath:string, skipText:string}>} skipTexts [{filePath: 忽略文本所在文件，不提供则默认所有文件, skipText: 忽略文本，filePath中出现该文本则不加入翻译Json}, ...]
 */
async function createTemplate(orgfolder, outputPath, skipPaths = [], skipTexts = []) {
    let template = await buildTemplate(orgfolder, skipPaths, skipTexts);
    let fileExist = false;
    try {
        fileExist = await fs.access(outputPath, fs.constants.F_OK);
        console.warn("已存在文件，将对原文件进行改动");
        let existData = JSON.parse(await fs.readFile(outputPath, 'utf8'));
        Object.keys(existData).forEach(key => {
            if (template[key] === undefined) {
                console.warn("文件 " + key + " 在新项目中不存在，将删除旧文件中的所有翻译条目");
            }
            else {
                Object.keys(existData[key]).forEach(subkey => {
                    if (template[key][subkey] === undefined) {
                        console.warn("文件 " + key + " 中的翻译条目 " + subkey + " 在新项目中不存在，将删除旧翻译条目");
                    }
                    else {
                        template[key][subkey] = existData[key][subkey];
                    }
                });
            }
        });
        try {
            await fs.writeFile(outputPath, JSON.stringify(template));
            console.log("已更新翻译文件：" + outputPath);
        }
        catch (err) {
            console.error("无法更新翻译文件：" + outputPath + "\n", err);
        }
    }
    catch (ex) {
        try {
            await fs.writeFile(outputPath, JSON.stringify(template));
            console.log("已生成翻译文件：" + outputPath);
        }
        catch (err) {
            console.error("无法创建翻译文件：" + outputPath + "\n", err);
        }
    }
}

async function emptyDistFolder(distfolder) {
    let filePaths = await fs.readdir(distfolder);
    for (let i = 0; i < filePaths.length; i++) {
        filePaths[i] = "./" + path.join(distfolder, filePaths[i]);
    }
    for (let i = 0; i < filePaths.length; i++) {
        let filePath = filePaths[i];
        try {
            let stats = await fs.stat(filePath);
            if (stats.isFile()) {
                // 删除文件
                // console.log("删除文件：" + filePath)
                await fs.unlink(filePath);
            } else {
                // 递归删除子文件夹
                await emptyDistFolder(filePath);
                // 删除文件夹
                // console.log("删除文件夹：" + filePath)
                await fs.rmdir(filePath);
            }

        }
        catch (err) {
            console.error("无法读取文件：" + filePaths[i] + "\n", err);
            continue;
        }
    }
}

async function translateRepo(orgfolder, transJsonPath, distfolder, skipPaths = []) {
    // 清理dist文件夹
    await emptyDistFolder(distfolder);
    // 读取翻译Json
    let existTranslation = null;
    try {
        existTranslation = JSON.parse(await fs.readFile(transJsonPath, 'utf8'));
    }
    catch (ex) {
        console.error("无法读取翻译文件：" + transJsonPath + "\n", err);
        console.warn("将直接复制原项目到目标文件夹");
    }
    // 复制文件
    let filePaths = await buildFileList(orgfolder, skipPaths);
    for (let i = 0; i < filePaths.length; i++) {
        let destPath = "./" + path.join(distfolder, ...filePaths[i].split("\\").slice(1));
        try {
            // 确保目录存在
            try{
                await fs.access(path.dirname(destPath));
            }
            catch(e) {
                await fs.mkdir(path.dirname(destPath), { recursive: true });
            }
            if (existTranslation === null || existTranslation[filePaths[i]] === undefined) {
                // 直接复制文件
                await fs.copyFile(filePaths[i], destPath);
                continue;
            }
            // 读取文件
            let data = await readFile(filePaths[i]);
            // 翻译文本
            Object.keys(existTranslation[filePaths[i]]).forEach(subkey => {
                let transText = existTranslation[filePaths[i]][subkey];
                data = data.replaceAll(subkey, transText);
            });
            // 写入文件
            await fs.writeFile(destPath, data, "utf8");
        }
        catch (err) {
            console.error("无法写入文件：从 " + filePaths[i] + " 到 " + destPath + "\n", err);
            continue;
        }
    }
    console.log("工作完成！翻译后的项目： " + distfolder);
}

module.exports.buildTemplate = buildTemplate;
module.exports.createTemplate = createTemplate;
module.exports.emptyDistFolder = emptyDistFolder;
module.exports.translateRepo = translateRepo;
