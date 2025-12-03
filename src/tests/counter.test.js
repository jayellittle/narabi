import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useCounterStore } from '../stores/counter';
describe('Counter Store', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });
    it('increments', () => {
        const counter = useCounterStore();
        expect(counter.count).toBe(0);
        counter.increment();
        expect(counter.count).toBe(1);
    });
    it('doubles', () => {
        const counter = useCounterStore();
        expect(counter.doubleCount).toBe(0);
        counter.increment();
        expect(counter.doubleCount).toBe(2);
    });
});
