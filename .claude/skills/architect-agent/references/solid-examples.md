# SOLID Violations Reference

Detailed examples of SOLID violations and their fixes.

## Single Responsibility Violations

### God Class
```typescript
// ❌ Violation: Class does everything
class UserManager {
  validateEmail(email: string) { /* ... */ }
  hashPassword(password: string) { /* ... */ }
  saveToDatabase(user: User) { /* ... */ }
  sendWelcomeEmail(user: User) { /* ... */ }
  generateReport(users: User[]) { /* ... */ }
  exportToCsv(users: User[]) { /* ... */ }
}

// ✅ Fixed: Separate concerns
class UserValidator { validateEmail(email: string) { /* ... */ } }
class PasswordHasher { hash(password: string) { /* ... */ } }
class UserRepository { save(user: User) { /* ... */ } }
class UserNotifier { sendWelcome(user: User) { /* ... */ } }
class UserReporter { generate(users: User[]) { /* ... */ } }
```

### Mixed Concerns in Functions
```typescript
// ❌ Violation: Function does multiple things
async function processOrder(order: Order) {
  // Validation
  if (!order.items.length) throw new Error('Empty order');
  
  // Price calculation
  const total = order.items.reduce((sum, i) => sum + i.price, 0);
  
  // Database save
  await db.orders.insert({ ...order, total });
  
  // Email notification
  await sendEmail(order.customer, 'Order confirmed');
  
  // Inventory update
  for (const item of order.items) {
    await db.inventory.decrement(item.id, item.quantity);
  }
}

// ✅ Fixed: Single responsibility per function
async function processOrder(order: Order) {
  validateOrder(order);
  const total = calculateTotal(order);
  const savedOrder = await saveOrder({ ...order, total });
  await notifyCustomer(savedOrder);
  await updateInventory(order.items);
}
```

## Open/Closed Violations

### Switch/If Chains for Types
```typescript
// ❌ Violation: Must modify function to add new payment type
function processPayment(payment: Payment) {
  switch (payment.type) {
    case 'credit': return processCreditCard(payment);
    case 'debit': return processDebitCard(payment);
    case 'paypal': return processPaypal(payment);
    // Adding new type requires modifying this function
  }
}

// ✅ Fixed: Strategy pattern
interface PaymentProcessor {
  process(payment: Payment): Promise<Result>;
}

class CreditCardProcessor implements PaymentProcessor { /* ... */ }
class PayPalProcessor implements PaymentProcessor { /* ... */ }

const processors: Record<string, PaymentProcessor> = {
  credit: new CreditCardProcessor(),
  paypal: new PayPalProcessor(),
};

function processPayment(payment: Payment) {
  return processors[payment.type].process(payment);
}
```

## Liskov Substitution Violations

### Throwing in Overridden Methods
```typescript
// ❌ Violation: Subclass breaks parent contract
class Bird {
  fly(): void { console.log('Flying'); }
}

class Penguin extends Bird {
  fly(): void { throw new Error('Penguins cannot fly'); }
}

// ✅ Fixed: Proper hierarchy
interface Bird { move(): void; }
interface FlyingBird extends Bird { fly(): void; }

class Sparrow implements FlyingBird {
  move() { this.fly(); }
  fly() { console.log('Flying'); }
}

class Penguin implements Bird {
  move() { console.log('Swimming'); }
}
```

## Interface Segregation Violations

### Fat Interfaces
```typescript
// ❌ Violation: Clients forced to implement unused methods
interface Worker {
  work(): void;
  eat(): void;
  sleep(): void;
  attendMeeting(): void;
  writeCode(): void;
  manageTeam(): void;
}

// ✅ Fixed: Segregated interfaces
interface Workable { work(): void; }
interface Eatable { eat(): void; }
interface Sleepable { sleep(): void; }
interface Manageable { manageTeam(): void; }

class Developer implements Workable, Eatable {
  work() { /* ... */ }
  eat() { /* ... */ }
}
```

## Dependency Inversion Violations

### Direct Instantiation
```typescript
// ❌ Violation: High-level module depends on concrete class
class OrderService {
  private database = new MySQLDatabase(); // Direct dependency
  private emailer = new SendGridEmailer(); // Direct dependency
  
  async createOrder(order: Order) {
    await this.database.save(order);
    await this.emailer.send(order.customer, 'Order created');
  }
}

// ✅ Fixed: Depend on abstractions
interface Database { save(entity: unknown): Promise<void>; }
interface Emailer { send(to: string, message: string): Promise<void>; }

class OrderService {
  constructor(
    private database: Database,
    private emailer: Emailer
  ) {}
  
  async createOrder(order: Order) {
    await this.database.save(order);
    await this.emailer.send(order.customer, 'Order created');
  }
}
```

## Common Refactoring Strategies

### Extract Class
When a class has multiple responsibilities, extract cohesive methods into new classes.

### Extract Method
When a function is too long, extract logical sections into separate functions.

### Replace Conditional with Polymorphism
When you have switch/if chains based on type, use strategy or factory patterns.

### Introduce Parameter Object
When functions have many parameters, group related ones into objects.

### Replace Inheritance with Composition
When inheritance creates tight coupling, prefer composition with interfaces.
