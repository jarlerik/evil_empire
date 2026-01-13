# Test Patterns Reference

Examples of comprehensive test coverage including corner cases.

## Test Structure Template

```typescript
describe('ComponentName', () => {
  describe('methodName', () => {
    // Happy path
    it('should [expected behavior] when [normal condition]', () => {});
    
    // Edge cases
    it('should handle empty input', () => {});
    it('should handle single element', () => {});
    it('should handle maximum size', () => {});
    
    // Error cases
    it('should throw when input is null', () => {});
    it('should throw when input is invalid', () => {});
    
    // Corner cases
    it('should handle concurrent calls', () => {});
    it('should handle unicode characters', () => {});
  });
});
```

## Corner Case Categories

### Numeric Inputs
```typescript
describe('calculateDiscount', () => {
  it('handles zero amount', () => expect(calculateDiscount(0)).toBe(0));
  it('handles negative amount', () => expect(() => calculateDiscount(-1)).toThrow());
  it('handles very large amount', () => expect(calculateDiscount(Number.MAX_SAFE_INTEGER)).toBeDefined());
  it('handles floating point precision', () => expect(calculateDiscount(0.1 + 0.2)).toBeCloseTo(/* expected */));
});
```

### String Inputs
```typescript
describe('sanitizeInput', () => {
  it('handles empty string', () => expect(sanitizeInput('')).toBe(''));
  it('handles whitespace only', () => expect(sanitizeInput('   ')).toBe(''));
  it('handles unicode', () => expect(sanitizeInput('héllo 世界')).toBeDefined());
  it('handles emoji', () => expect(sanitizeInput('Hello 👋')).toBeDefined());
  it('handles very long string', () => expect(sanitizeInput('x'.repeat(10000))).toBeDefined());
  it('handles null bytes', () => expect(sanitizeInput('hello\x00world')).toBeDefined());
});
```

### Collection Inputs
```typescript
describe('processItems', () => {
  it('handles empty array', () => expect(processItems([])).toEqual([]));
  it('handles single item', () => expect(processItems([1])).toEqual([/* expected */]));
  it('handles duplicates', () => expect(processItems([1, 1, 1])).toEqual([/* expected */]));
  it('handles large array', () => expect(processItems(Array(10000).fill(1))).toBeDefined());
  it('handles mixed types if applicable', () => {});
});
```

### Async Operations
```typescript
describe('fetchData', () => {
  it('resolves with data on success', async () => {});
  it('rejects on network error', async () => {});
  it('handles timeout', async () => {});
  it('handles concurrent requests', async () => {
    const results = await Promise.all([fetchData(), fetchData(), fetchData()]);
    // Verify all resolved correctly
  });
  it('handles cancellation', async () => {});
});
```

### Date/Time
```typescript
describe('scheduleEvent', () => {
  it('handles timezone boundaries', () => {});
  it('handles DST transitions', () => {});
  it('handles leap years', () => {});
  it('handles end of month', () => {});
  it('handles midnight', () => {});
});
```

## Missing Test Indicators

Flag implementations missing tests for:

1. **No test file exists** for implementation file
2. **Untested public methods** - exported functions without corresponding tests
3. **Missing error path tests** - try/catch blocks without error case tests
4. **Missing boundary tests** - numeric ranges without min/max tests
5. **Missing async tests** - async functions without failure/timeout tests

## Test Quality Smells

### Over-Mocking
```typescript
// ❌ Tests nothing real
it('returns mocked data', () => {
  jest.mock('./everything');
  expect(mockFn()).toBe(mockResult); // What are we even testing?
});
```

### Testing Implementation
```typescript
// ❌ Brittle - breaks on refactor
it('calls internal method', () => {
  component.process();
  expect(component._internalMethod).toHaveBeenCalled();
});

// ✅ Test behavior, not implementation
it('produces expected output', () => {
  expect(component.process(input)).toEqual(expectedOutput);
});
```

### Shared Mutable State
```typescript
// ❌ Tests affect each other
let sharedData = [];
beforeEach(() => { sharedData.push('item'); });
// Tests become order-dependent

// ✅ Fresh state per test
beforeEach(() => { sharedData = []; });
```
