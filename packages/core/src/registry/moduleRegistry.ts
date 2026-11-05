import type { ClockModule } from '../entities/module.js';

export class ModuleRegistry {
  private readonly modules = new Map<string, ClockModule>();

  register(module: ClockModule): void {
    if (this.modules.has(module.id)) {
      throw new Error(
        `Ya existe un módulo registrado con el ID "${module.id}".`,
      );
    }

    this.modules.set(module.id, module);
  }

  get(id: string): ClockModule | undefined {
    return this.modules.get(id);
  }

  getAll(): ClockModule[] {
    return [...this.modules.values()];
  }

  getEnabled(): ClockModule[] {
    return this.getAll().filter(
      (module) => module.status === 'enabled',
    );
  }

  getDependents(targetId: string): ClockModule[] {
    return this.getAll().filter((module) =>
      module.dependencies.some(
        (dependency) =>
          dependency.kind === 'module' &&
          dependency.id === targetId,
      ),
    );
  }

  rename(id: string, newName: string): ClockModule {
    const module = this.modules.get(id);

    if (!module) {
      throw new Error(
        `No existe ningún módulo con el ID "${id}".`,
      );
    }

    module.name = newName;
    module.updatedAt = new Date();

    return module;
  }
}
