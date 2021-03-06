//
// View.js
// Created on 06/01/2020
//
// Copyright (c) 2020 Teplovs
// This file is under Apache License v2.0
// 
// See https://www.apache.org/licenses/LICENSE-2.0 for license information
// 

import { OutlineStyle, outlineStyleToCssValue } from "../Values/OutlineStyle"
import { Positioning, positioningToCssValue } from "../Values/Positioning"
import { VNode, VNodeType } from "../VirtualDOM/VNode"
import { Reconciler } from "../VirtualDOM/Reconciler"
import { Length, pixels } from "../Values/Length"
import { Color } from "../Values/Color"
import { State } from "../State/State"
import { Font } from "../Values/Font"
import { Worker } from "../Worker"

// function Reconciler.updateVNodeDOM is described after the class View

function isValidLength(value) {
    return value instanceof Length || value instanceof Number || typeof value === "number"
}

function toLength(value) {
    return value instanceof Length ? value : pixels(value)
}

function isString(value) {
    return value instanceof String || typeof value === "string"
}

/**
 * A class to respresent the UI item
 * @class
 */
export class View {
    /**
     * @param {Object} options Options for the View
     */
    constructor (options) {
        this.lastVNode = null
        this.mounted = false
        this.key = null
        this.styles = {}
        this.events = {}
        this.attributes = {}
        this.options = options || {}
        this.preferForceInvalidation = false

        this.state = new State((state = this.getInitialState(), action) => {
            switch (action.type) {
                case "set":
                    return Object.assign(state, action.value)
                default:
                    return state
            }
        })

        this.state.subscribe(() => {
            if (this.preferForceInvalidation) {
                this.forceInvalidate()
            } else {
                this.invalidate()
            }
        })

        this.state.set = (keys) => {
            this.state.dispatch({ type: "set", value: keys })
        }

        this.state.get = (key) => {
            return this.state._currentState[key]
        }
        
        Object.defineProperty(this, "mounted", {
            get: () => this.lastVNode instanceof VNode && this.lastVNode.dom instanceof Node,
            set: () => {}
        })
    }

    /**
     * Method to set the prefered invalidation mode to force (when state is changed, view will update without scheduling)
     */
    preferForceInvalidation () {
        this.preferForceInvalidation = true
        return this
    }

    /**
     * Method to set the prefered invalidation mode to scheduled (when state is changed, view will update with scheduling)
     */
    preferScheduledInvalidation () {
        this.preferForceInvalidation = false
        return this
    }

    /**
     * A method to set a unique key to the view to make the reconcilation more fast and optimized
     * @prop {Number|String} key Key that will be set to the view
     */
    setKey(key) {
        if (typeof key === "number" || key instanceof Number) {
            this.key = Number(key)
        } else {
            this.key = key.toString()
        }

        return this
    }

    /**
     * A method that returns the key->value object, which will be transformed into the state
     * @example
     * class Test extends View {
     *     getInitialState() {
     *         return {
     *             test: true
     *         }
     *     }
     * }
     * @returns {Object} Variables in the state and their default values
     */
    getInitialState () {
        return {}
    }

    /**
     * A method that returns the body (content) of the view
     * @param {String} [side] Side of the rendering (`"server"`, `"client"` etc.)
     */
    getBody (side = "client") {
        var { styles, attributes, events, key } = this

        return new VNode({
            key: key,
            tag: "div",
            styles: styles,
            events: events,
            attributes: attributes
        }, this)
    }

    /**
     * A method called after mounting
     */
    handleMount() {
        if (this.events.mount) {
            this.events.mount.forEach(handler => {
                handler(this)
            })
        }
    }

    /**
     * A method called before unmounting
     */
    handleUnmount() {
        if (this.events.unmount) {
            this.events.unmount.forEach(handler => {
                handler(this)
            })
        }
    }

    /**
     * A method called after invalidation
     */
    handleInvalidation() {
        if (this.events.invalidation) {
            this.events.invalidation.forEach(handler => {
                handler(this)
            })
        }
    }

    /**
     * A method to mount the view
     * @param {Node} parent DOM object where to mount the view
     */
    mountTo (parent = document.body) {
        if (this.mounted) {
            throw new Error("The view is already mounted")
        }

        if (!(parent instanceof Node)) {
            throw new Error("The parent is not an instance of Node")
        }

        Worker.addUnitOfWork(() => {
            View.renderToVNode({ view: this, saveVNode: true })
            this.lastVNode.mountTo(parent)
            this.handleMount()
        })
    }

    /**
     * A method to unmount the view
     */
    unmount () {
        if (!this.mounted) {
            throw new Error("The view is not mounted")
        }

        Worker.addUnitOfWork(() => {
            this.lastVNode.unmount()
        })
    }

    /**
     * A method to force reload the view
     */
    invalidate () {
        if (this.mounted) {
            Worker.addUnitOfWork(() => {
                this.forceInvalidate()
            })
        }
    }

    /**
     * A method to force reload the view without scheduling
     */
    forceInvalidate () {
        if (this.mounted) {
            let vNode = View.renderToVNode({ view: this })
            Reconciler.updateVNodeDOM(this.lastVNode, vNode)
            this.lastVNode = vNode
            this.handleInvalidation()
        }
    }

    //
    // Styling section
    //

    /**
     * A method to set the ability to select the component's text/image to true or false
     * @param {Boolean} [value] 
     */
    setSelectableTo (value) {
        if (typeof value === "boolean" || value instanceof Boolean) {
            this.styles.userSelect = Boolean(value) ? "auto" : "none"
        }

        return this
    }

    /**
     * A method to set the foreground properties
     * @param {Object} options
     * @param {Color}  [options.color]  Color that will be set to the foreground
     */
    setForeground ({ color }) {
        if (color instanceof Color) {
            this.styles.color = color
        }

        return this
    }

    /**
     * A method to set the background properties
     * @param {Object} options
     * @param {COlor}  [options.color]  Color that will be set to the background
     */
    setBackground({ color }) {
        if (color instanceof Color) {
            this.styles.backgroundColor = color
        }

        return this
    }

    /**
     * A method to set the handler for the event
     * @param {String}      event       Name of an event for which to add handler
     * @param {Function}    handler     Function that will be called after event happened
     */
    addHandlerFor (event, handler) {
        if (isString(event) && typeof handler === "function") {
            if (!(event in this.events)) {
                this.events[event] = []
            }

            this.events[event].push(handler)
        }

        return this
    }

    /**
     * A method to set the font properties
     * @param {Font}    [font]  Font to set for the view
     */
    setFont (font) {
        if (font instanceof Font) {
            this.styles.font = font
        }

        return this
    }

    /**
     * A method to change the offset of the view
     * @param {Object}          options
     * @param {Length|Number}   [options.all]       Offset for all sides
     * @param {Length|Number}   [options.top]       Offset for top side
     * @param {Length|Number}   [options.right]     Offset for right side
     * @param {Length|Number}   [options.bottom]    Offset for bottom side
     * @param {Length|Number}   [options.left]      Offset for left side
     */
    setOffset ({ all, top, right, bottom, left }) {
        if (isValidLength(all)) {
            this.styles.margin = toLength(all)
        }

        if (isValidLength(top)) {
            this.styles.marginTop = toLength(top)
        }

        if (isValidLength(right)) {
            this.styles.marginRight = toLength(right)
        }

        if (isValidLength(bottom)) {
            this.styles.marginBottom = toLength(bottom)
        }

        if (isValidLength(left)) {
            this.styles.marginLeft = toLength(left)
        }

        return this
    }

    /**
     * A method to change the padding of the view
     * @param {Object}          options
     * @param {Length|Number}   [options.all]       Padding for all sides
     * @param {Length|Number}   [options.top]       Padding for top side
     * @param {Length|Number}   [options.right]     Padding for right side
     * @param {Length|Number}   [options.bottom]    Padding for bottom side
     * @param {Length|Number}   [options.left]      Padding for left side
     */
    setPadding ({ all, top, right, bottom, left }) {
        if (isValidLength(all)) {
            this.styles.padding = toLength(all)
        }

        if (isValidLength(top)) {
            this.styles.paddingTop = toLength(top)
        }

        if (isValidLength(right)) {
            this.styles.paddingRight = toLength(right)
        }

        if (isValidLength(bottom)) {
            this.styles.paddingBottom = toLength(bottom)
        }

        if (isValidLength(left)) {
            this.styles.paddingLeft = toLength(left)
        }

        return this
    }

    /**
     * A method to set the outline of the view
     * @param {Object}          options
     * @param {Length|Number}   [options.all]       Size of outline
     * @param {Length|Number}   [options.top]       Top outline size
     * @param {Length|Number}   [options.right]     Right outline size
     * @param {Length|Number}   [options.bottom]    Bottom outline size
     * @param {Length|Number}   [options.left]      Left outline size
     * @param {Length|Number}   [options.radius]    Radius of outline
     * @param {Color}           [options.color]     Outline color
     * @param {Symbol}          [options.style]     Style of an outline. Item of OutlineStyle enum
     */
    setOutline ({ left, top, right, bottom, all, color, style, radius }) {
        if (isValidLength(all)) {
            this.styles.borderWidth = toLength(all)
        }

        if (isValidLength(left)) {
            this.styles.borderLeftWidth = toLength(left)
        }

        if (isValidLength(right)) {
            this.styles.borderRightWidth = toLength(right)
        }

        if (isValidLength(top)) {
            this.styles.borderTopWidth = toLength(top)
        }

        if (isValidLength(bottom)) {
            this.styles.borderBottomWidth = toLength(bottom)
        }

        if (isValidLength(radius)) {
            this.styles.borderRadius = toLength(radius)
        } else if (Array.isArray(radius)) {
            this.styles.borderRadius = radius.map(item => {
                return toLength(item)
            }).join(" ")
        }

        if (color instanceof Color) {
            this.styles.borderColor = color
        }

        if (OutlineStyle.contains(style)) {
            this.styles.borderStyle = outlineStyleToCssValue(style)
        }

        return this
    }

    /**
     * A method to set the size of the view
     * @param {Object}          options
     * @param {Length|Number}   [options.width]     Width of the view
     * @param {Length|Number}   [options.height]    Height of the view
     */
    setSize({ width, height }) {
        if (isValidLength(width)) {
            this.styles.width = toLength(width)
        }

        if (isValidLength(height)) {
            this.styles.height = toLength(height)
        }

        return this
    }

    /**
     * A method to set the minimal size of the view
     * @param {Object}          options
     * @param {Length|Number}   [options.width]     Minimal width of the view
     * @param {Length|Number}   [options.height]    Minimal height of the view
     */
    setMinSize({ width, height }) {
        if (isValidLength(width)) {
            this.styles.minWidth = toLength(width)
        }

        if (isValidLength(height)) {
            this.styles.minHeight = toLength(height)
        }

        return this
    }

    /**
     * A method to set the maximal size of the view
     * @param {Object}          options
     * @param {Length|Number}   [options.width]     Maximal width of the view
     * @param {Length|Number}   [options.height]    Maximal height of the view
     */
    setMaxSize({ width, height }) {
        if (isValidLength(width)) {
            this.styles.maxWidth = toLength(width)
        }

        if (isValidLength(height)) {
            this.styles.maxHeight = toLength(height)
        }

        return this
    }

    /**
     * A method to set the positioning of the View 
     * @param {Object}          options
     * @param {Length|Number}   [options.top]       Top position
     * @param {Length|Number}   [options.right]     Right position
     * @param {Length|Number}   [options.bottom]    Bottom position
     * @param {Length|Number}   [options.left]      Left position
     * @param {Symbol}          [options.type]      Type of positioning. Item of Positioning enum
     */
    setPositioning({ type, top, left, right, bottom }) {
        if (Positioning.contains(type)) {
            this.styles.position = positioningToCssValue(type)
        }

        if (isValidLength(left)) {
            this.styles.left = toLength(left)
        }

        if (isValidLength(right)) {
            this.styles.right = toLength(right)
        }

        if (isValidLength(top)) {
            this.styles.top = toLength(top)
        }

        if (isValidLength(bottom)) {
            this.styles.bottom = toLength(bottom)
        }

        return this
    }

    /**
     * A method to apply CSS styles to the view
     * @param {Object} properties Object with CSS properties and their values
     */
    applyCSS (properties) {
        for (let property in properties) {
            if (isString(property) && isString(properties[property])) {
                this.styles[property] = properties[property]
            }
        }

        return this
    }

    /**
     * A method to set the attributes for the View
     * @param {Object} attributes Object with HTML attributes and their values
     */
    setAttributes(attributes) {
        for (let name in attributes) {
            if (isString(name) && isString(attributes[name])) {
                this.attributes[name] = attributes[name]
            }
        }

        return this
    }

    /**
     * A method to convert the view to HTML string
     */
    toString(side = "server") {
        var node = View.renderToVNode({ view: this, saveVNode: false, ignoreStateChange: true, side: side })
        return node.toString()
    }

    /**
     * A method to clone styles, attributes and events of one view to this
     */
    applyViewProperties(view) {
        if (view instanceof View) {
            this.styles = Object.assign(this.styles, typeof view.styles === "object" ? view.styles : {})
            this.attributes = Object.assign(this.styles, typeof view.styles === "object" ? view.attributes : {})

            for (let i in view.events) {
                this.addHandlerFor(i, view.events[i])
            }

            if (view.key) {
                this.setKey(view.key)
            }
        }

        return this
    }

    /**
     * A method to clone mounting, invalidation and unmounting handlers of one view to this
     */
    applyViewHandlers(view) {
        if (view instanceof View) {
            this.handleMount = view.handleMount
            this.handleInvalidation = view.handleInvalidation
            this.handleUnmount = view.handleUnmount
        }

        return this
    }

    /**
     * A method to make "alive" the DOM, generated using the server side rendering
     * @param {Node} dom DOM node, generated using the server side rendering
     */
    hydrate(dom) {
        const node = View.renderToVNode({ view: this, saveVNode: true })
        node.hydrate(dom)
    }

    /**
     * A function to render view until body returns VNode
     * @param   {Object}     options
     * @param   {View|VNode} options.view                 View to render to VNode
     * @param   {Boolean}    [options.saveVNode]          If specified, the vNode will be saved to the `view.lastVNode`
     * @param   {Boolean}    [options.ignoreStateChange]  If specified, the state change will be ignored
     * @param   {String}     [options.side]               Side of the rendering (`"server"`, `"client"` etc.)
     * @returns {VNode}      Result of recursive rendering of view to virtual node
     */
    static renderToVNode({ view, saveVNode = false, ignoreStateChange = false, side = "client" }) {
        var node

        if (view instanceof VNode) {
            node = view
        } else {
            node = view
            let views = []
            
            while (node instanceof View) {
                views.push(node)

                if (ignoreStateChange) {
                    const nodeStateSet = node.state.set
                    node.state.set = () => {}
                    
                    let newNode = node.getBody(side)
                    node.state.set = nodeStateSet
                    node = newNode
                } else {
                    node = node.getBody(side)
                }
            }

            if (node != null) {
                if (!(node instanceof VNode)) {
                    throw new Error("Expected a VNode as the result of rendering the View (the rendering is recursive, so the error can be in the parent class or in the child class)")
                }

                node.view = views[views.length - 1]
                for (let i in node.body) {
                    if (node.body[i] instanceof View || node.body[i] instanceof VNode) {
                        node.body[i] = View.renderToVNode({ view: node.body[i], saveVNode: true, ignoreStateChange: ignoreStateChange, side: side })
                    } else {
                        throw new Error("Unexpected child passed")
                    }
                }
            }

            if (saveVNode) {
                for (let i = 0; i < views.length; ++i) {
                    views[i].lastVNode = node
                }
            }
        }

        return node
    }

}

