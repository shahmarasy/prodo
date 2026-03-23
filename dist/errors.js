"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserError = void 0;
class UserError extends Error {
    constructor(message) {
        super(message);
        this.name = "UserError";
    }
}
exports.UserError = UserError;
