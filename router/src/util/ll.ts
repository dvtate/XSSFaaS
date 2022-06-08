/**
 * Generic doubly Linked List/Node data structure
 */
export default class LL<T> {
    /**
     * @param item item stored in this LL node
     * @param prev previous item in the LL
     * @param next next item in the LL
     */
    constructor(
        public item: T = null,
        public prev: LL<T> = null,
        public next: LL<T> = null,
    ) {}

    /**
     * Convert self into an array
     * @returns array containing elements in linked list
     */
    toArray() {
        const ret = [];
        let n: LL<T> = this;
        do {
            if (n.item)
                ret.push(n.item);
            n = n.next;
        } while (n);
        return ret;
    }

    /**
     * Find first node which matches test
     * @param test criteria to search for
     * @returns node or null
     */
    find(test: (v: T, i: number) => boolean) {
        let n: LL<T> = this;
        let i = 0;
        do {
            if (test(n.item, i))
                return n;
            n = n.next;
            i++;
        } while (n);
        return null;
    }

    /**
     * Remove this node from the linked list
     */
    removeSelf() {
        if (this.next)
            this.next.prev = this.prev;
        if (this.prev)
            this.prev.next = this.next;
    }

    /**
     * Insert node after this one
     * @param n ll node to insert
     */
    insertAfter(n: LL<T>) {
        // Remove node from LL
        n.removeSelf();

        // Insert node
        const next = this.next;
        this.next = n;
        n.prev = this;
        n.next = next;
    }

    /**
     * Call this method every time the nodes item changes
     * and the linked list will stay sorted
     *
     * @param compare comparison function to use for sorting
     */
    sortedReinsert(compare: (a: T, b: T) => number) {
        // Move to right
        let n: LL<T> = this;
        while (n.next && compare(this.item, n.next.item) < 0)
            n = n.next;
        if (n != this) {
            // Edge case for new end of list
            if (!n.next && compare(this.item, n.item) < 0)
                n.insertAfter(this);
            else
                n.prev.insertAfter(this);
            return;
        }

        // Move to left
        n = this;
        while (n.prev && n.prev.item && compare(this.prev.item, this.item) > 0)
            n = n.prev;
        if (n != this)
            n.insertAfter(this);
    }

    // TODO
    *[Symbol.iterator]() {
        let n: LL<T> = this;
        let i = 0;
        do {
            yield n.item;
            n = n.next;
            i++;
        } while (n);
        return i;
    };
}
