"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github_1 = require("@actions/github");
function listAllTags(octokit, ctx, page = 1) {
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield octokit.rest.repos.listTags({
            owner: ctx.repo.owner,
            repo: ctx.repo.repo,
            per_page: 100,
            page
        });
        const tags = new Set(res.data.map(t => t.name));
        if (tags.size < 100) {
            return tags;
        }
        const other = yield listAllTags(octokit, github_1.context, page + 1);
        return new Set([...tags, ...other]);
    });
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        // Get and validate inputs
        const githubToken = core.getInput('github_token');
        const { GITHUB_SHA } = process.env;
        if (githubToken === '') {
            throw new Error('github token cannot be empty');
        }
        if (GITHUB_SHA === '') {
            throw new Error('missing GITHUB_SHA env variables');
        }
        // Get github client
        const octokit = github_1.getOctokit(githubToken);
        const existingTags = yield listAllTags(octokit, github_1.context);
        core.info(`I found the following tags ${[...existingTags].join(', ')}`);
        const date = new Date();
        const newTagPrefix = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
        core.info(`New tag should be ${newTagPrefix}`);
        for (let i = 0; i < 1000; i++) {
            const newTag = `${newTagPrefix}.${i}`;
            if (existingTags.has(newTag)) {
                continue;
            }
            core.info(`Creating tag ${newTag}`);
            const createTagRes = yield octokit.rest.git.createTag({
                owner: github_1.context.repo.owner,
                repo: github_1.context.repo.repo,
                tag: newTag,
                message: newTag,
                object: String(GITHUB_SHA),
                type: 'commit'
            });
            if (createTagRes.status !== 201) {
                throw new Error(`Could not create tag. Received ${createTagRes.status} from API`);
            }
            core.info(`Creating ref ${newTag}`);
            const createRefRes = yield octokit.rest.git.createRef({
                owner: github_1.context.repo.owner,
                repo: github_1.context.repo.repo,
                ref: `refs/tags/${newTag}`,
                sha: createTagRes.data.sha
            });
            if (createRefRes.status !== 201) {
                throw new Error(`Could not create ref. Received ${createRefRes.status} from API`);
            }
            return {
                tag: newTag
            };
        }
        throw new Error('could not guess the correct new tag');
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const output = yield run();
            core.setOutput('tag', output.tag);
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
main();
