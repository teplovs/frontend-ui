//
// Reconciler.js
// Created on 17/04/2020
//
// Copyright (c) 2020 Teplovs
// This file is under Apache License v2.0
// 
// See https://www.apache.org/licenses/LICENSE-2.0 for license information
// 

import { VNode, VNodeType } from "./VNode"
import { View } from "../Views/View"

/**
 * A class that is used for reconcilation
 * @class
 */
export class Reconciler {
    /**
     * A method to update the virtual node's DOM
     * @param {VNode} lastVNode 
     * @param {VNode} vNode 
     */
    static updateVNodeDOM (lastVNode, vNode) {
        if (lastVNode.tag !== vNode.tag || lastVNode.type === VNodeType.text || vNode.type === VNodeType.text) {
            lastVNode.dom.replaceWith(vNode.toHTMLNode({ save: true }))
            return
        }

        for (let i in lastVNode.styles) {
            if (!(i in vNode.styles)) {
                lastVNode.dom.style[i] = ""
            }
        }

        for (let i in vNode.styles) {
            if (!(i in lastVNode.styles && lastVNode.styles[i].toString() === vNode.styles[i].toString())) {
                lastVNode.dom.style[i] = vNode.styles[i]
            }
        }

        for (let i in lastVNode.events) {
            for (let j in vNode.events[i]) {
                lastVNode.dom.removeEventListener(i, lastVNode.events[i][j])
            }
        }

        for (let i in vNode.events) {
            for (let j in vNode.events[i]) {
                if (typeof vNode.events[i][j] === "function") {
                    lastVNode.dom.addEventListener(i, vNode.events[i][j])
                }
            }
        }

        for (let i in lastVNode.attributes) {
            if (!(i in vNode.attributes)) {
                lastVNode.dom.removeAttribute(i)
            }
        }

        for (let i in vNode.attributes) {
            if (!(i in lastVNode.attributes && lastVNode.attributes[i].toString() === vNode.attributes[i].toString())) {
                lastVNode.dom.setAttribute(i, vNode.attributes[i])
            }
        }

        if (lastVNode.body.length !== vNode.body.length) {
            let keysUpdated = []
            for (let i in lastVNode.body) {
                let keyFound = false
                for (let j in vNode.body) {
                    if (vNode.body[j].key && lastVNode.body[i].key && lastVNode.body[i].key === vNode.body[j].key) {
                        keyFound = true
                        keysUpdated.push(vNode.body[j].key)
                        this.updateVNodeDOM(lastVNode.body[i], vNode.body[j])
                        break
                    }
                }
                
                if (!keyFound) {
                    lastVNode.body[i].dom.parentNode.removeChild(lastVNode.body[i].dom)
                }
            }

            for (let i in vNode.body) {
                if (!vNode.body[i].key || (vNode.body[i].key && keysUpdated.indexOf(vNode.body[i].key) < 0)) {
                    vNode.body[i].toHTMLNode({ save: true })
                    if (i > 0) {
                        vNode.body[i - 1].dom.parentNode.insertBefore(vNode.body[i].dom, vNode.body[i - 1].dom.nextSibling)
                    } else {
                        lastVNode.dom.prepend(vNode.body[i].dom)
                    }

                    if (vNode.body[i].view instanceof View) {
                        vNode.body[i].view.handleMount()
                    }
                }
            }
        } else {
            for (let i in vNode.body) {
                this.updateVNodeDOM(lastVNode.body[i], vNode.body[i])
            }
        }

        vNode.dom = lastVNode.dom
        if (vNode.view instanceof View) {
            vNode.view.handleInvalidation()
        }
    }
}

